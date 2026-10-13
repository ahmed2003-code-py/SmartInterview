import { Prisma, type Interview, type Role } from "@prisma/client";
import { prisma } from "../db/prisma.js";
import { config, QUESTION_COUNTS, type InterviewLength } from "../config.js";
import { HttpError } from "../middleware/errors.js";
import { evaluateTurn, planInterview, writeReport } from "../ai/interviewer.js";
import { CRITERIA, type Criteria, type InterviewContext } from "../ai/types.js";

const MAX_DURATION_SEC = 2 * 60 * 60;

const detailInclude = {
  role: true,
  questions: { orderBy: { order: "asc" }, include: { answer: true } },
  report: true,
} satisfies Prisma.InterviewInclude;

type InterviewDetail = Prisma.InterviewGetPayload<{ include: typeof detailInclude }>;

function contextFor(interview: Interview & { role: Role }): InterviewContext {
  const lang = interview.language === "ar" ? "ar" : "en";
  return {
    roleName: lang === "ar" ? interview.role.nameAr : interview.role.nameEn,
    roleNameEn: interview.role.nameEn,
    focusAreas: interview.role.focusAreas,
    difficulty: interview.difficulty as InterviewContext["difficulty"],
    language: lang,
    maxQuestions: interview.maxQuestions,
    jobDescription: interview.jobDescription,
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
    difficulty: interview.difficulty,
    length: interview.length,
    maxQuestions: interview.maxQuestions,
    hasJobDescription: Boolean(interview.jobDescription),
    isMock: interview.isMock,
    overallScore: interview.overallScore,
    startedAt: interview.startedAt,
    endedAt: interview.endedAt,
    durationSec: interview.durationSec,
    role: { id: interview.role.id, slug: interview.role.slug, nameEn: interview.role.nameEn, nameAr: interview.role.nameAr },
    questions: interview.questions.map((q) => ({
      id: q.id,
      order: q.order,
      text: q.text,
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
  input: { roleId: string; language: "en" | "ar"; difficulty: InterviewContext["difficulty"]; length: InterviewLength; jobDescription?: string | null },
) {
  const role = await prisma.role.findUnique({ where: { id: input.roleId } });
  if (!role) throw new HttpError(400, "INVALID_ROLE", "Unknown role");

  const maxQuestions = QUESTION_COUNTS[input.length];
  const jobDescription = input.jobDescription?.trim().slice(0, config.limits.maxJobDescriptionChars) || null;
  const draft = { role, language: input.language, difficulty: input.difficulty, maxQuestions, jobDescription, topics: [] } as unknown as Interview & { role: Role };
  const plan = await planInterview(contextFor(draft));

  const interview = await prisma.interview.create({
    data: {
      userId,
      roleId: role.id,
      language: input.language,
      difficulty: input.difficulty,
      length: input.length,
      maxQuestions,
      jobDescription,
      topics: plan.topics,
      isMock: config.mockAI,
      questions: { create: { order: 1, text: plan.firstQuestion.text, kind: "MAIN", topic: plan.firstQuestion.topic } },
    },
    include: detailInclude,
  });
  return serialize(interview);
}

export async function getInterview(userId: string, id: string) {
  return serialize(await loadOwned(userId, id));
}

export async function assertActive(userId: string, id: string) {
  const interview = await prisma.interview.findFirst({
    where: { id, userId },
    select: { status: true, language: true, questions: { orderBy: { order: "desc" }, take: 1, select: { text: true } } },
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
  });

  const avg = CRITERIA.reduce((sum, c) => sum + result.scores[c], 0) / CRITERIA.length;
  try {
    await prisma.$transaction(async (tx) => {
      await tx.answer.create({
        data: {
          questionId: current.id,
          transcript: input.transcript,
          durationSec: input.durationSec,
          ...result.scores,
          score: Math.round(avg * 10),
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
  if (interview.status === "COMPLETED") return serialize(interview);

  const answered = interview.questions.filter((q) => q.answer);
  const endedAt = interview.endedAt ?? new Date();
  const durationSec = Math.min(MAX_DURATION_SEC, Math.round((endedAt.getTime() - interview.startedAt.getTime()) / 1000));

  if (answered.length === 0) {
    await prisma.interview.update({ where: { id }, data: { status: "ABANDONED", endedAt, durationSec } });
    return getInterview(userId, id);
  }

  // Scores are computed here so they are always consistent with the per-answer scores.
  const categoryScores = Object.fromEntries(
    CRITERIA.map((c) => [c, Math.round((answered.reduce((s, q) => s + q.answer![c], 0) / answered.length) * 10)]),
  ) as Record<keyof Criteria, number>;
  const overall = Math.round(answered.reduce((s, q) => s + q.answer!.score, 0) / answered.length);

  // Record the end time before the (possibly failing) AI call so a retry keeps the real duration.
  if (!interview.endedAt) await prisma.interview.update({ where: { id }, data: { endedAt, durationSec } });

  const text = await writeReport(
    contextFor(interview),
    answered.map((q) => ({ question: q.text, answer: q.answer!.transcript, score: q.answer!.score, feedback: q.answer!.feedback })),
    categoryScores,
    overall,
  );

  await prisma.$transaction([
    // Unanswered trailing question (interview ended early) is not part of the report.
    prisma.question.deleteMany({ where: { interviewId: id, answer: null } }),
    prisma.report.upsert({
      where: { interviewId: id },
      create: { interviewId: id, overallScore: overall, categoryScores, ...text },
      update: { overallScore: overall, categoryScores, ...text },
    }),
    prisma.interview.update({ where: { id }, data: { status: "COMPLETED", overallScore: overall, endedAt, durationSec } }),
  ]);
  return getInterview(userId, id);
}

const summarySelect = {
  id: true,
  status: true,
  language: true,
  difficulty: true,
  length: true,
  overallScore: true,
  startedAt: true,
  durationSec: true,
  role: { select: { id: true, slug: true, nameEn: true, nameAr: true } },
  _count: { select: { questions: true } },
} satisfies Prisma.InterviewSelect;

export async function listInterviews(userId: string, filters: { roleId?: string; language?: string; status?: string }) {
  return prisma.interview.findMany({
    where: {
      userId,
      roleId: filters.roleId || undefined,
      language: filters.language || undefined,
      status: filters.status ? (filters.status as Interview["status"]) : { not: "ABANDONED" },
    },
    orderBy: { startedAt: "desc" },
    take: 100,
    select: summarySelect,
  });
}

export async function dashboard(userId: string) {
  const [completed, recent] = await Promise.all([
    prisma.interview.findMany({
      where: { userId, status: "COMPLETED" },
      orderBy: { startedAt: "asc" },
      select: { id: true, overallScore: true, durationSec: true, startedAt: true, role: { select: { nameEn: true, nameAr: true } } },
    }),
    prisma.interview.findMany({ where: { userId, status: { not: "ABANDONED" } }, orderBy: { startedAt: "desc" }, take: 5, select: summarySelect }),
  ]);
  const scores = completed.map((i) => i.overallScore ?? 0);
  return {
    totalInterviews: completed.length,
    averageScore: scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null,
    bestScore: scores.length ? Math.max(...scores) : null,
    practiceSeconds: completed.reduce((s, i) => s + (i.durationSec ?? 0), 0),
    trend: completed.slice(-12).map((i) => ({ id: i.id, score: i.overallScore ?? 0, date: i.startedAt, roleEn: i.role.nameEn, roleAr: i.role.nameAr })),
    recent,
  };
}
