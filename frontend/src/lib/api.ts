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
  } catch (err) {
    if (err instanceof DOMException && (err.name === "AbortError" || err.name === "TimeoutError")) throw new ApiError(0, "TIMEOUT", "Request timed out");
    throw new ApiError(0, "NETWORK_ERROR", "Network error");
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(res.status, data.error ?? "SERVER_ERROR", data.message ?? "Request failed");
  return data as T;
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body?: unknown, init: Pick<RequestInit, "signal" | "headers"> = {}) =>
    request<T>(path, { ...init, method: "POST", body: body instanceof FormData ? body : JSON.stringify(body ?? {}) }),
  patch: <T>(path: string, body: unknown) => request<T>(path, { method: "PATCH", body: JSON.stringify(body) }),
  del: <T>(path: string) => request<T>(path, { method: "DELETE" }),
};

// ---- Shared API types ----
export type ExperienceLevel = "student" | "graduate" | "early" | "experienced";

export interface Preferences {
  theme?: "light" | "dark" | "system";
  uiLanguage?: "ar" | "en";
  interviewLanguage?: "ar" | "en" | "smart";
  difficulty?: Difficulty;
  length?: Length;
  autoPlayVoice?: boolean;
  captions?: boolean;
  reducedMotion?: "system" | "reduce";
}

export interface User {
  id: string;
  name: string;
  email: string;
  createdAt: string;
  headline: string | null;
  targetRole: string | null;
  specialization: string | null;
  experienceLevel: ExperienceLevel | null;
  bio: string | null;
  /** Changes whenever the photo changes; null = no photo (initials are shown). */
  avatarVersion: number | null;
  preferences: Preferences;
}

/** A suggested role from the server (quick option in setup). */
export interface Role {
  id: string;
  slug: string;
  nameEn: string;
  nameAr: string;
  descriptionEn?: string;
  descriptionAr?: string;
  domain?: "education" | "general";
}

/** The role an interview is for: a suggested role, or exactly what the student typed (custom). */
export interface InterviewRole {
  id: string | null;
  slug: string | null;
  nameEn: string;
  nameAr: string;
  custom?: boolean;
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
  role: InterviewRole;
  specialization: string | null;
  questions: QuestionDTO[];
  report: ReportDTO | null;
  /** Score of the previous completed interview for the same role (only when one exists). */
  previousScore?: number | null;
}

export interface InterviewSummary {
  id: string;
  status: InterviewStatus;
  language: "en" | "ar";
  languageMode?: "fixed" | "smart";
  difficulty: Difficulty;
  length: Length;
  overallScore: number | null;
  startedAt: string;
  durationSec: number | null;
  role: InterviewRole;
  specialization?: string | null;
  /** Score change vs the previous completed interview for the same role (dashboard only). */
  change?: number | null;
  _count: { questions: number };
}

export interface AppConfig {
  mockAI: boolean;
  arabicVoice: boolean;
  maxAnswerSeconds: number;
  maxJobDescriptionChars: number;
}
