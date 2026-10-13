import { z } from "zod";
import { config } from "../config.js";
import { chatJSON } from "../providers/llm.js";
import { HttpError } from "../middleware/errors.js";
import { mockPlan, mockReport, mockTurn } from "./mock.js";
import { notesRewritePrompt, planPrompt, reportPrompt, turnPrompt } from "./prompts.js";
import type { Criteria, InterviewContext, PlanResult, ReportText, TurnInput, TurnResult } from "./types.js";
import { arabicShare, scriptLanguage } from "./language.js";

const score = z.coerce.number().transform((n) => Math.max(1, Math.min(10, Math.round(n))));
const text = (max: number) => z.string().trim().min(1).transform((s) => s.slice(0, max));

const PlanSchema = z.object({
  topics: z.array(text(80)).min(1).max(12),
  firstQuestion: z.object({ topic: text(80), text: text(500) }),
});

const TurnSchema = z.object({
  scores: z.object({ relevance: score, clarity: score, communication: score, subjectKnowledge: score, educationalReasoning: score }),
  feedback: text(600),
  suggestedAnswer: text(1200),
  decision: z.enum(["FOLLOW_UP", "NEXT_TOPIC", "FINISH"]),
  topic: z.string().trim().max(80).nullish().transform((v) => v || null),
  anchor: z.string().trim().max(300).nullish().catch(null),
  reaction: z.string().trim().max(240).nullish().transform((v) => v || null),
  responseLanguage: z.enum(["ar", "en", "mixed"]).nullish().catch(null),
  languageSwitchReason: z.string().max(40).nullish().catch(null),
  nextQuestion: z.string().trim().max(400).nullish().transform((v) => v || null),
});

const ReportSchema = z.object({
  strengths: z.array(text(300)).min(1).max(4),
  improvements: z.array(text(300)).min(1).max(4),
  practiceAreas: z.array(text(160)).min(1).max(4),
  generalFeedback: text(900),
  questions: z.array(z.object({ feedback: text(600), suggestedAnswer: text(1000) })).optional(),
});

/** "Reaction. Question?" — adds a sentence break if the model left none; drops reactions that are themselves questions. */
function joinReaction(reaction: string | null, question: string | null) {
  if (!question || !reaction || /[?؟]$/.test(reaction)) return question;
  return /[.!،,:…]$/.test(reaction) ? `${reaction} ${question}` : `${reaction}. ${question}`;
}

/** Ask the LLM, validate the JSON, and retry once if the shape is wrong. */
async function ask<T>(schema: z.ZodType<T>, prompt: { system: string; user: string }, maxTokens: number, effort: "low" | "medium" = "low"): Promise<T> {
  const messages = [
    { role: "system" as const, content: prompt.system },
    { role: "user" as const, content: prompt.user },
  ];
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const parsed = schema.safeParse(await chatJSON(messages, maxTokens, effort));
      if (parsed.success) return parsed.data;
      console.warn(`LLM response failed validation (attempt ${attempt})`, parsed.error.issues.slice(0, 3));
    } catch (err) {
      if (attempt === 2) throw err;
      console.warn(`LLM call failed (attempt ${attempt})`, err instanceof Error ? err.message : err);
    }
  }
  throw new HttpError(502, "AI_FAILED", "The AI returned an invalid response");
}

export async function planInterview(ctx: InterviewContext): Promise<PlanResult> {
  if (config.mockAI) return mockPlan(ctx);
  return ask(PlanSchema, planPrompt(ctx), 500, "medium");
}

async function llmTurn(input: TurnInput, retryNote?: string): Promise<TurnResult> {
  const { reaction, responseLanguage, languageSwitchReason: _r, anchor: _a, ...r } = await ask(
    TurnSchema,
    turnPrompt(input.ctx, input.history, input.question, input.currentKind, input.answer, input.questionNumber, input.consecutiveFollowUps, {
      recent: input.recentLanguages,
      requested: input.requestedLanguage,
      retryNote,
    }),
    800,
    "medium",
  );
  // The interviewer's short reaction is spoken together with the next question.
  const nextQuestion = joinReaction(reaction, r.nextQuestion);
  // Fixed mode always speaks the interview language; smart mode trusts the model but checks the script.
  const language = input.ctx.languageMode === "fixed" ? input.ctx.language : nextQuestion ? scriptLanguage(nextQuestion) : (responseLanguage ?? input.ctx.language);
  return { ...r, nextQuestion, responseLanguage: language };
}

/** Word-overlap similarity (0..1) between two questions, ignoring very short words. */
function similarity(a: string, b: string) {
  const words = (t: string) => new Set(t.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, " ").split(/\s+/).filter((w) => w.length > 3));
  const A = words(a);
  const B = words(b);
  if (!A.size || !B.size) return 0;
  let common = 0;
  for (const w of A) if (B.has(w)) common++;
  return common / Math.min(A.size, B.size);
}

export async function evaluateTurn(input: TurnInput): Promise<TurnResult> {
  let result: TurnResult;
  if (config.mockAI) result = { ...(await mockTurn(input)), responseLanguage: input.ctx.language };
  else {
    result = await llmTurn(input);
    // A real interviewer moves on after two follow-ups and never asks the same thing twice.
    const previous = [...input.history.map((h) => h.question), input.question];
    const repeated = result.nextQuestion ? previous.find((q) => similarity(q, result.nextQuestion!) >= 0.6) : undefined;
    const stuck = input.consecutiveFollowUps >= 2 && result.decision === "FOLLOW_UP";
    if (result.nextQuestion && (repeated || stuck)) {
      result = await llmTurn(
        input,
        `IMPORTANT: your previous attempt ${stuck ? "stayed on the same thread after two follow-ups" : "repeated an earlier question"}. Move to a DIFFERENT area now (decision NEXT_TOPIC) and do not ask again about: "${(repeated ?? input.question).slice(0, 160)}".`,
      );
    }
    // An explicit "talk to me in English/Arabic" must be honoured: retry once if the question came back in the other script.
    const wanted = input.ctx.languageMode === "smart" ? input.requestedLanguage : null;
    const wrong = wanted && result.nextQuestion && (wanted === "en" ? result.responseLanguage !== "en" : result.responseLanguage === "en");
    if (wrong) result = await llmTurn(input, `IMPORTANT: your previous attempt ignored the request. Write the reaction and question entirely in ${wanted === "en" ? "English" : "Arabic"}.`);
  }

  // The server, not the model, has the final word on interview length.
  const isLast = input.questionNumber >= input.ctx.maxQuestions;
  const minQuestions = Math.ceil(input.ctx.maxQuestions * 0.75);
  if (isLast || !result.nextQuestion) return { ...result, decision: "FINISH", nextQuestion: null };
  if (result.decision === "FINISH" && input.questionNumber < minQuestions) return { ...result, decision: "NEXT_TOPIC" };
  if (result.decision === "FINISH") return { ...result, nextQuestion: null };
  // At most two follow-ups in a row on one topic; a third becomes a new main question.
  if (result.decision === "FOLLOW_UP" && input.consecutiveFollowUps >= 2) return { ...result, decision: "NEXT_TOPIC" };
  return result;
}

export async function writeReport(
  ctx: InterviewContext,
  items: { question: string; answer: string; score: number; feedback: string; suggestedAnswer: string }[],
  categoryScores: Record<keyof Criteria, number>,
  overall: number,
  reportLanguage: "ar" | "en",
): Promise<ReportText & { questions?: { feedback: string; suggestedAnswer: string }[] }> {
  if (config.mockAI) return mockReport({ ...ctx, language: reportLanguage }, categoryScores, overall);
  // Per-question notes are written turn by turn (in smart mode, in whichever language that turn
  // used). Any note not already in the report language is rewritten, so one report never mixes languages.
  const wrongLang = (t: string) => (reportLanguage === "ar" ? arabicShare(t) < 0.5 : arabicShare(t) > 0.15);
  const rewrite = items.some((it) => wrongLang(it.feedback) || wrongLang(it.suggestedAnswer));
  const result = await ask(ReportSchema, reportPrompt(ctx, items, categoryScores, overall, reportLanguage, rewrite), rewrite ? 2600 : 1400, "medium");
  if (!rewrite) return { ...result, questions: undefined };
  if (result.questions?.length === items.length) return result;
  // The combined call dropped the notes: one smaller, dedicated call. Failing that, keep the originals.
  const notes = items.map(({ feedback, suggestedAnswer }) => ({ feedback, suggestedAnswer }));
  const NotesSchema = z.object({ questions: z.array(z.object({ feedback: text(600), suggestedAnswer: text(1000) })).length(items.length) });
  const fixed = await ask(NotesSchema, notesRewritePrompt(ctx, notes, reportLanguage), 1800).catch(() => null);
  return { ...result, questions: fixed?.questions };
}
