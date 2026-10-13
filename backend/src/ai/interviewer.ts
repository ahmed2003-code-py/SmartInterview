import { z } from "zod";
import { config } from "../config.js";
import { chatJSON } from "../providers/llm.js";
import { HttpError } from "../middleware/errors.js";
import { mockPlan, mockReport, mockTurn } from "./mock.js";
import { planPrompt, reportPrompt, turnPrompt } from "./prompts.js";
import type { Criteria, InterviewContext, PlanResult, ReportText, TurnInput, TurnResult } from "./types.js";

const score = z.coerce.number().transform((n) => Math.max(1, Math.min(10, Math.round(n))));
const text = (max: number) => z.string().trim().min(1).transform((s) => s.slice(0, max));

const PlanSchema = z.object({
  topics: z.array(text(80)).min(1).max(12),
  firstQuestion: z.object({ topic: text(80), text: text(400) }),
});

const TurnSchema = z.object({
  scores: z.object({ relevance: score, clarity: score, communication: score, subjectKnowledge: score, educationalReasoning: score }),
  feedback: text(600),
  suggestedAnswer: text(1200),
  decision: z.enum(["FOLLOW_UP", "NEXT_TOPIC", "FINISH"]),
  topic: z.string().trim().max(80).nullish().transform((v) => v || null),
  nextQuestion: z.string().trim().max(400).nullish().transform((v) => v || null),
});

const ReportSchema = z.object({
  strengths: z.array(text(300)).min(1).max(5),
  improvements: z.array(text(300)).min(1).max(5),
  practiceAreas: z.array(text(120)).min(1).max(5),
  generalFeedback: text(1500),
});

/** Ask the LLM, validate the JSON, and retry once if the shape is wrong. */
async function ask<T>(schema: z.ZodType<T>, prompt: { system: string; user: string }, maxTokens: number): Promise<T> {
  const messages = [
    { role: "system" as const, content: prompt.system },
    { role: "user" as const, content: prompt.user },
  ];
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const parsed = schema.safeParse(await chatJSON(messages, maxTokens));
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
  return ask(PlanSchema, planPrompt(ctx), 500);
}

export async function evaluateTurn(input: TurnInput): Promise<TurnResult> {
  const result = config.mockAI
    ? await mockTurn(input)
    : await ask(TurnSchema, turnPrompt(input.ctx, input.history, input.question, input.currentKind, input.answer, input.questionNumber), 700);

  // The server, not the model, has the final word on interview length.
  const isLast = input.questionNumber >= input.ctx.maxQuestions;
  const minQuestions = Math.ceil(input.ctx.maxQuestions * 0.75);
  if (isLast || !result.nextQuestion) return { ...result, decision: "FINISH", nextQuestion: null };
  if (result.decision === "FINISH" && input.questionNumber < minQuestions) return { ...result, decision: "NEXT_TOPIC" };
  if (result.decision === "FINISH") return { ...result, nextQuestion: null };
  // Never two follow-ups in a row: treat a second one as a new main question.
  if (result.decision === "FOLLOW_UP" && input.currentKind === "FOLLOW_UP") return { ...result, decision: "NEXT_TOPIC" };
  return result;
}

export async function writeReport(ctx: InterviewContext, items: { question: string; answer: string; score: number; feedback: string }[], categoryScores: Record<keyof Criteria, number>, overall: number): Promise<ReportText> {
  if (config.mockAI) return mockReport(ctx, categoryScores, overall);
  return ask(ReportSchema, reportPrompt(ctx, items, categoryScores, overall), 900);
}
