import { Prisma, type Interview, type Role } from "@prisma/client";
import { prisma } from "../db/prisma.js";
import { config, QUESTION_COUNTS, type InterviewLength } from "../config.js";
import { HttpError } from "../middleware/errors.js";
import { evaluateTurn, planInterview, writeReport } from "../ai/interviewer.js";
import { CRITERIA, type Criteria, type InterviewContext, type SpokenLanguage } from "../ai/types.js";
import { arabicShare, detectLanguageRequest, scriptLanguage } from "../ai/language.js";
import { backgroundText } from "./profileCv.js";

const MAX_DURATION_SEC = 2 * 60 * 60;

// ---- Pure scoring / language rules (unit-tested) ----
const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, Number.isFinite(n) ? n : lo));
const pickCriteria = (a: Criteria): Criteria => Object.fromEntries(CRITERIA.map((c) => [c, a[c]])) as unknown as Criteria;

/** One answer: the five 1-10 criteria → 0-100. */
export function answerScore(scores: Criteria): number {
  const avg = CRITERIA.reduce((sum, c) => sum + clamp(scores[c], 0, 10), 0) / CRITERIA.length;
  return Math.round(avg * 10);
}

/** Interview: category averages (0-100) and overall (mean of answer scores, 0-100). */
export function aggregateScores(answers: (Criteria & { score: number })[]) {
  const n = Math.max(1, answers.length);
  const categoryScores = Object.fromEntries(CRITERIA.map((c) => [c, Math.round((answers.reduce((s, a) => s + clamp(a[c], 0, 10), 0) / n) * 10)])) as Record<keyof Criteria, number>;
  const overall = Math.round(answers.reduce((s, a) => s + clamp(a.score, 0, 100), 0) / n);
  return { categoryScores, overall };
}

/** Fixed interviews: their language. Smart: the language that dominates the student's answers. */
export function reportLanguageFor(mode: string, language: string, transcripts: string[]): "ar" | "en" {
  if (mode === "smart") return arabicShare(transcripts.join(" ")) >= 0.5 ? "ar" : "en";
  return language === "ar" ? "ar" : "en";
}

const detailInclude = {
  role: true,
  questions: { orderBy: { order: "asc" }, include: { answer: true } },
  report: true,
} satisfies Prisma.InterviewInclude;

type InterviewDetail = Prisma.InterviewGetPayload<{ include: typeof detailInclude }>;

// Competencies used when the student typed a role we have no preset for.
const CUSTOM_FOCUS = ["Core knowledge and skills of this role", "Real examples from studies, projects or work", "Problem solving in realistic situations", "Communication and teamwork", "Motivation and fit for the role"];

type RoleLike = { id: string; slug: string; nameEn: string; nameAr: string } | null;

/** The role as shown to the student: a suggested role, or exactly what they typed. */
export function roleView(role: RoleLike, roleTitle: string | null) {
  if (role) return { id: role.id, slug: role.slug, nameEn: role.nameEn, nameAr: role.nameAr, custom: false };
  const title = roleTitle ?? "—";
  return { id: null, slug: null, nameEn: title, nameAr: title, custom: true };
}

function contextFor(interview: Interview & { role: Role | null }): InterviewContext {
  const lang = interview.language === "ar" ? "ar" : "en";
  const role = interview.role;
  const title = interview.roleTitle ?? "";
  return {
    roleName: role ? (lang === "ar" ? role.nameAr : role.nameEn) : title,
    roleNameEn: role ? role.nameEn : title,
    domain: role ? (role.domain === "general" ? "general" : "education") : "custom",
    specialization: interview.specialization,
    focusAreas: role ? role.focusAreas : CUSTOM_FOCUS,
    difficulty: interview.difficulty as InterviewContext["difficulty"],
    language: lang,
    languageMode: interview.languageMode === "smart" ? "smart" : "fixed",
    maxQuestions: interview.maxQuestions,
    jobDescription: interview.jobDescription,
    cvProfile: interview.cvProfile,
    topics: interview.topics,
  };
}

async function loadOwned(userId: string, id: string): Promise<InterviewDetail> {
  const interview = await prisma.interview.findFirst({ where: { id, userId }, include: detailInclude });
  if (!interview) throw new HttpError(404, "NOT_FOUND", "Interview not found");
  return interview;
}

/** Shape sent to the client. Per-answer evaluations stay hidden until the interview is finished. */
function serialize(interview: InterviewDetail) {
  const done = interview.status === "COMPLETED";
  return {
    id: interview.id,
    status: interview.status,
    language: interview.language,
    languageMode: interview.languageMode,
    difficulty: interview.difficulty,
    length: interview.length,
    maxQuestions: interview.maxQuestions,
    hasJobDescription: Boolean(interview.jobDescription),
    hasCv: Boolean(interview.cvProfile),
    isMock: interview.isMock,
    overallScore: interview.overallScore,
    startedAt: interview.startedAt,
    endedAt: interview.endedAt,
    durationSec: interview.durationSec,
    role: roleView(interview.role, interview.roleTitle),
    specialization: interview.specialization,
    questions: interview.questions.map((q) => ({
      id: q.id,
      order: q.order,
      text: q.text,
      language: q.language ?? interview.language,
      kind: q.kind,
      topic: q.topic,
      answer: q.answer
        ? {
            transcript: q.answer.transcript,
            durationSec: q.answer.durationSec,
            ...(done
              ? {
                  score: q.answer.score,
                  feedback: q.answer.feedback,
                  suggestedAnswer: q.answer.suggestedAnswer,
                  scores: Object.fromEntries(CRITERIA.map((c) => [c, q.answer![c]])),
                }
              : {}),
          }
        : null,
    })),
    report: done ? interview.report : null,
  };
}

export async function createInterview(
  userId: string,
  input: {
    roleId?: string | null;
    roleTitle?: string | null;
    specialization?: string | null;
    language: "en" | "ar";
    languageMode?: "fixed" | "smart";
    difficulty: InterviewContext["difficulty"];
    length: InterviewLength;
    jobDescription?: string | null;
    cvProfile?: string | null;
    /** Use the account's primary CV when no interview-specific CV was given. */
    useProfileCv?: boolean;
  },
) {
  // A suggested role (by id), or any role the student typed. A typed name that matches a suggestion uses it.
  const title = input.roleTitle?.replace(/\s+/g, " ").trim().slice(0, 80) || null;
  let role = input.roleId ? await prisma.role.findUnique({ where: { id: input.roleId } }) : null;
  if (input.roleId && !role) throw new HttpError(400, "INVALID_ROLE", "Unknown role");
  if (!role && title) role = await prisma.role.findFirst({ where: { OR: [{ nameEn: { equals: title, mode: "insensitive" } }, { nameAr: title }] } });
  if (!role && !title) throw new HttpError(400, "INVALID_ROLE", "Choose or type a role");
  const roleTitle = role ? null : title;
  const specialization = input.specialization?.replace(/\s+/g, " ").trim().slice(0, 80) || null;

  const maxQuestions = QUESTION_COUNTS[input.length];
  const jobDescription = input.jobDescription?.trim().slice(0, config.limits.maxJobDescriptionChars) || null;
  const languageMode = input.languageMode ?? "fixed";
  const cvProfile = await candidateContext(userId, input.cvProfile, input.useProfileCv ?? true);
  const draft = { role, roleTitle, specialization, language: input.language, languageMode, difficulty: input.difficulty, maxQuestions, jobDescription, cvProfile, topics: [] } as unknown as Interview & { role: Role | null };
  const plan = await planInterview(contextFor(draft));

  const interview = await prisma.interview.create({
    data: {
      userId,
      roleId: role?.id ?? null,
      roleTitle,
      specialization,
      language: input.language,
      languageMode,
      difficulty: input.difficulty,
      length: input.length,
      maxQuestions,
      jobDescription,
      cvProfile,
      topics: plan.topics,
      isMock: config.mockAI,
      // The language actually used (by script), so the voice and labels match the text.
      questions: { create: { order: 1, text: plan.firstQuestion.text, language: languageMode === "smart" ? scriptLanguage(plan.firstQuestion.text) : input.language, kind: "MAIN", topic: plan.firstQuestion.topic } },
    },
    include: detailInclude,
  });
  return serialize(interview);
}

/**
 * Background the interviewer may use, in priority order:
 * 1. a CV uploaded for THIS interview; 2. the account's primary CV (unless switched off for this interview);
 * 3. otherwise the profile background the user confirmed. Current-interview choices (role, specialization,
 * job description) are separate fields and always win. Built server-side; nothing from the client is trusted here.
 */
export async function candidateContext(userId: string, interviewCv: string | null | undefined, useProfileCv: boolean): Promise<string | null> {
  const own = interviewCv?.trim().slice(0, 2_000);
  if (own) return own;
  const u = await prisma.user.findUnique({
    where: { id: userId },
    select: { cvProfile: true, headline: true, currentRole: true, experienceLevel: true, education: true, experience: true, projects: true, skills: true, certifications: true, languages: true },
  });
  if (!u) return null;
  if (useProfileCv && u.cvProfile) return u.cvProfile.slice(0, 2_000);
  const confirmed = backgroundText({
    headline: u.headline ?? undefined,
    currentRole: u.currentRole ?? undefined,
    experienceLevel: (u.experienceLevel as never) ?? undefined,
    education: (u.education as never) ?? [],
    experience: (u.experience as never) ?? [],
    projects: (u.projects as never) ?? [],
    skills: u.skills,
    certifications: u.certifications,
    languages: u.languages,
  });
  return confirmed ? confirmed.slice(0, 2_000) : null;
}

export async function getInterview(userId: string, id: string) {
  const interview = await loadOwned(userId, id);
  const data = serialize(interview);
  if (interview.status !== "COMPLETED") return { ...data, previousScore: null };
  // Comparison is only shown against the previous completed interview for the SAME role.
  const previous = await prisma.interview.findFirst({
    where: { userId, status: "COMPLETED", startedAt: { lt: interview.startedAt }, ...(interview.roleId ? { roleId: interview.roleId } : { roleId: null, roleTitle: { equals: interview.roleTitle ?? "", mode: "insensitive" } }) },
    orderBy: { startedAt: "desc" },
    select: { overallScore: true },
  });
  return { ...data, previousScore: previous?.overallScore ?? null };
}

export async function assertActive(userId: string, id: string) {
  const interview = await prisma.interview.findFirst({
    where: { id, userId },
    select: { status: true, language: true, roleTitle: true, specialization: true, role: { select: { slug: true, domain: true } }, questions: { orderBy: { order: "desc" }, take: 1, select: { text: true } } },
  });
  if (!interview) throw new HttpError(404, "NOT_FOUND", "Interview not found");
  if (interview.status !== "IN_PROGRESS") throw new HttpError(409, "INTERVIEW_CLOSED", "This interview has already ended");
  return interview;
}

export async function submitAnswer(userId: string, id: string, input: { questionId: string; transcript: string; durationSec?: number }) {
  const interview = await loadOwned(userId, id);
  if (interview.status !== "IN_PROGRESS") throw new HttpError(409, "INTERVIEW_CLOSED", "This interview has already ended");

  const current = interview.questions.at(-1)!;
  if (current.id !== input.questionId) throw new HttpError(409, "STALE_QUESTION", "This question is no longer active");
  if (current.answer) throw new HttpError(409, "ALREADY_ANSWERED", "This question was already answered");

  const ctx = contextFor(interview);
  const history = interview.questions
    .filter((q) => q.answer)
    .map((q) => ({ question: q.text, answer: q.answer!.transcript, kind: q.kind, topic: q.topic }));

  const result = await evaluateTurn({
    ctx,
    history,
    question: current.text,
    currentKind: current.kind,
    currentTopic: current.topic,
    answer: input.transcript,
    questionNumber: current.order,
    recentLanguages: interview.questions.slice(-4).map((q) => (q.language ?? interview.language) as SpokenLanguage),
    requestedLanguage: interview.languageMode === "smart" ? detectLanguageRequest(input.transcript) : null,
    consecutiveFollowUps: (() => {
      let n = 0;
      for (let k = interview.questions.length - 1; k >= 0 && interview.questions[k].kind === "FOLLOW_UP"; k--) n++;
      return n;
    })(),
  });


  try {
    await prisma.$transaction(async (tx) => {
      await tx.answer.create({
        data: {
          questionId: current.id,
          transcript: input.transcript,
          durationSec: input.durationSec,
          ...result.scores,
          score: answerScore(result.scores),
          feedback: result.feedback,
          suggestedAnswer: result.suggestedAnswer,
        },
      });
      if (result.nextQuestion) {
        await tx.question.create({
          data: {
            interviewId: id,
            order: current.order + 1,
            text: result.nextQuestion,
            language: result.responseLanguage,
            kind: result.decision === "FOLLOW_UP" ? "FOLLOW_UP" : "MAIN",
            topic: result.decision === "FOLLOW_UP" ? current.topic : result.topic,
          },
        });
      }
    });
  } catch (err) {
    // A duplicate submit raced past the check above.
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      throw new HttpError(409, "ALREADY_ANSWERED", "This question was already answered");
    }
    throw err;
  }

  return { shouldEndInterview: !result.nextQuestion, decision: result.decision, interview: await getInterview(userId, id) };
}

export async function finishInterview(userId: string, id: string) {
  const interview = await loadOwned(userId, id);
  if (interview.status === "COMPLETED") return getInterview(userId, id);

  const answered = interview.questions.filter((q) => q.answer);
  const endedAt = interview.endedAt ?? new Date();
  const durationSec = Math.min(MAX_DURATION_SEC, Math.round((endedAt.getTime() - interview.startedAt.getTime()) / 1000));

  if (answered.length === 0) {
    await prisma.interview.update({ where: { id }, data: { status: "ABANDONED", endedAt, durationSec } });
    return getInterview(userId, id);
  }

  // Scores are computed here so they are always consistent with the per-answer scores.
  const { categoryScores, overall } = aggregateScores(answered.map((q) => ({ ...pickCriteria(q.answer!), score: q.answer!.score })));

  // Record the end time before the (possibly failing) AI call so a retry keeps the real duration.
  if (!interview.endedAt) await prisma.interview.update({ where: { id }, data: { endedAt, durationSec } });

  // Report language: fixed interviews use their language; smart interviews use the language that
  // dominates the student's answers. Every report text field (and label in the UI) follows it.
  const reportLanguage = reportLanguageFor(interview.languageMode, interview.language, answered.map((q) => q.answer!.transcript));

  const { questions: rewritten, ...text } = await writeReport(
    contextFor(interview),
    answered.map((q) => ({ question: q.text, answer: q.answer!.transcript, score: q.answer!.score, feedback: q.answer!.feedback, suggestedAnswer: q.answer!.suggestedAnswer })),
    categoryScores,
    overall,
    reportLanguage,
  );

  await prisma.$transaction([
    ...(rewritten ?? []).map((r, i) => prisma.answer.update({ where: { id: answered[i].answer!.id }, data: { feedback: r.feedback, suggestedAnswer: r.suggestedAnswer } })),
    // Unanswered trailing question (interview ended early) is not part of the report.
    prisma.question.deleteMany({ where: { interviewId: id, answer: null } }),
    prisma.report.upsert({
      where: { interviewId: id },
      create: { interviewId: id, overallScore: overall, language: reportLanguage, categoryScores, ...text },
      update: { overallScore: overall, language: reportLanguage, categoryScores, ...text },
    }),
    prisma.interview.update({ where: { id }, data: { status: "COMPLETED", overallScore: overall, endedAt, durationSec } }),
  ]);
  return getInterview(userId, id);
}

const summarySelect = {
  id: true,
  status: true,
  language: true,
  languageMode: true,
  difficulty: true,
  length: true,
  overallScore: true,
  startedAt: true,
  durationSec: true,
  roleId: true,
  roleTitle: true,
  specialization: true,
  role: { select: { id: true, slug: true, nameEn: true, nameAr: true } },
  _count: { select: { questions: true } },
} satisfies Prisma.InterviewSelect;

type SummaryRow = Prisma.InterviewGetPayload<{ select: typeof summarySelect }>;

/** Key that identifies "the same role" for comparisons (suggested role id, or the typed title). */
const roleKey = (i: { roleId: string | null; roleTitle: string | null }) => i.roleId ?? `custom:${(i.roleTitle ?? "").toLowerCase()}`;

function summary({ roleId: _roleId, roleTitle, role, ...rest }: SummaryRow, change: number | null = null) {
  return { ...rest, role: roleView(role, roleTitle), change };
}

export async function listInterviews(userId: string, filters: { language?: string; status?: string }) {
  const rows = await prisma.interview.findMany({
    where: {
      userId,
      language: filters.language || undefined,
      status: filters.status ? (filters.status as Interview["status"]) : { not: "ABANDONED" },
    },
    orderBy: { startedAt: "desc" },
    take: 100,
    select: summarySelect,
  });
  return rows.map((r) => summary(r));
}

export async function dashboard(userId: string) {
  const [completed, recent] = await Promise.all([
    prisma.interview.findMany({
      where: { userId, status: "COMPLETED" },
      orderBy: { startedAt: "asc" },
      select: { ...summarySelect, report: { select: { categoryScores: true } } },
    }),
    prisma.interview.findMany({ where: { userId, status: { not: "ABANDONED" } }, orderBy: { startedAt: "desc" }, take: 5, select: summarySelect }),
  ]);
  const scores = completed.map((i) => i.overallScore ?? 0);

  // Change vs the previous completed interview for the same role (only when one exists).
  const changeById = new Map<string, number>();
  const lastByRole = new Map<string, number>();
  for (const i of completed) {
    const prev = lastByRole.get(roleKey(i));
    if (prev != null && i.overallScore != null) changeById.set(i.id, i.overallScore - prev);
    if (i.overallScore != null) lastByRole.set(roleKey(i), i.overallScore);
  }

  // Average of each skill across completed reports.
  const reports = completed.map((i) => i.report?.categoryScores as Record<string, number> | undefined).filter((r): r is Record<string, number> => !!r);
  const skills = reports.length
    ? Object.fromEntries(CRITERIA.map((c) => [c, Math.round(reports.reduce((sum, r) => sum + (r[c] ?? 0), 0) / reports.length)]))
    : null;

  return {
    totalInterviews: completed.length,
    averageScore: scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null,
    bestScore: scores.length ? Math.max(...scores) : null,
    practiceSeconds: completed.reduce((s, i) => s + (i.durationSec ?? 0), 0),
    skills,
    trend: completed.slice(-12).map((i) => {
      const role = roleView(i.role, i.roleTitle);
      return { id: i.id, score: i.overallScore ?? 0, date: i.startedAt, roleEn: role.nameEn, roleAr: role.nameAr };
    }),
    recent: recent.map((r) => summary(r, changeById.get(r.id) ?? null)),
  };
}

export async function findOwnedQuestion(userId: string, interviewId: string, questionId: string) {
  const question = await prisma.question.findFirst({
    where: { id: questionId, interviewId, interview: { userId } },
    select: { id: true, text: true, language: true, interview: { select: { language: true } } },
  });
  if (!question) throw new HttpError(404, "NOT_FOUND", "Question not found");
  return question;
}
