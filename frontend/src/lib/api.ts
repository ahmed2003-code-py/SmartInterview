export class ApiError extends Error {
  status: number;
  code: string;
  constructor(status: number, code: string, message: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`/api${path}`, {
      credentials: "include",
      ...init,
      headers: init.body instanceof FormData ? init.headers : { "Content-Type": "application/json", ...init.headers },
    });
  } catch {
    throw new ApiError(0, "NETWORK_ERROR", "Network error");
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(res.status, data.error ?? "SERVER_ERROR", data.message ?? "Request failed");
  return data as T;
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body?: unknown) => request<T>(path, { method: "POST", body: body instanceof FormData ? body : JSON.stringify(body ?? {}) }),
};

// ---- Shared API types ----
export interface User {
  id: string;
  name: string;
  email: string;
}

export interface Role {
  id: string;
  slug: string;
  nameEn: string;
  nameAr: string;
  descriptionEn?: string;
  descriptionAr?: string;
}

export type Criterion = "relevance" | "clarity" | "communication" | "subjectKnowledge" | "educationalReasoning";
export type InterviewStatus = "IN_PROGRESS" | "COMPLETED" | "ABANDONED";
export type Difficulty = "beginner" | "intermediate" | "advanced";
export type Length = "quick" | "standard" | "full";

export interface QuestionDTO {
  id: string;
  order: number;
  text: string;
  /** Language the question was asked in (smart mode can switch). */
  language: "ar" | "en" | "mixed";
  kind: "MAIN" | "FOLLOW_UP";
  topic: string | null;
  answer: null | {
    transcript: string;
    durationSec: number | null;
    score?: number;
    feedback?: string;
    suggestedAnswer?: string;
    scores?: Record<Criterion, number>;
  };
}

export interface ReportDTO {
  overallScore: number;
  /** Language the report text is written in; the report page renders in it. */
  language: "ar" | "en" | null;
  categoryScores: Record<Criterion, number>;
  strengths: string[];
  improvements: string[];
  practiceAreas: string[];
  generalFeedback: string;
}

export interface InterviewDTO {
  id: string;
  status: InterviewStatus;
  language: "en" | "ar";
  languageMode: "fixed" | "smart";
  difficulty: Difficulty;
  length: Length;
  maxQuestions: number;
  hasJobDescription: boolean;
  hasCv: boolean;
  isMock: boolean;
  overallScore: number | null;
  startedAt: string;
  endedAt: string | null;
  durationSec: number | null;
  role: Role;
  questions: QuestionDTO[];
  report: ReportDTO | null;
}

export interface InterviewSummary {
  id: string;
  status: InterviewStatus;
  language: "en" | "ar";
  difficulty: Difficulty;
  length: Length;
  overallScore: number | null;
  startedAt: string;
  durationSec: number | null;
  role: Role;
  _count: { questions: number };
}

export interface AppConfig {
  mockAI: boolean;
  arabicVoice: boolean;
  maxAnswerSeconds: number;
  maxJobDescriptionChars: number;
}
