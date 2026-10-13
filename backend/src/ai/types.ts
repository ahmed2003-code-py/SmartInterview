import type { Lang } from "../providers/stt.js";

export interface Criteria {
  relevance: number;
  clarity: number;
  communication: number;
  subjectKnowledge: number;
  educationalReasoning: number;
}

export const CRITERIA: (keyof Criteria)[] = ["relevance", "clarity", "communication", "subjectKnowledge", "educationalReasoning"];

export interface InterviewContext {
  roleName: string; // in the interview language
  roleNameEn: string;
  focusAreas: string[];
  difficulty: "beginner" | "intermediate" | "advanced";
  language: Lang;
  maxQuestions: number;
  jobDescription: string | null;
  topics: string[];
}

export interface PlanResult {
  topics: string[];
  firstQuestion: { topic: string; text: string };
}

export interface HistoryItem {
  question: string;
  answer: string;
  kind: string;
  topic: string | null;
}

export interface TurnInput {
  ctx: InterviewContext;
  history: HistoryItem[];
  question: string;
  currentKind: string;
  currentTopic: string | null;
  answer: string;
  questionNumber: number;
  /** Follow-ups in a row ending with the current question (0 if it is a main question). */
  consecutiveFollowUps: number;
}

export type Decision = "FOLLOW_UP" | "NEXT_TOPIC" | "FINISH";

export interface TurnResult {
  scores: Criteria;
  feedback: string;
  suggestedAnswer: string;
  decision: Decision;
  topic: string | null;
  nextQuestion: string | null;
}

export interface ReportText {
  strengths: string[];
  improvements: string[];
  practiceAreas: string[];
  generalFeedback: string;
}
