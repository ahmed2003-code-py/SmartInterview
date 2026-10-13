import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function clockTime(totalSeconds: number) {
  const s = Math.max(0, Math.floor(totalSeconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

export type ScoreBand = "excellent" | "good" | "fair" | "needsWork";
export function scoreBand(score: number): ScoreBand {
  if (score >= 85) return "excellent";
  if (score >= 70) return "good";
  if (score >= 50) return "fair";
  return "needsWork";
}

/** Text color class for a 0-100 score. */
export function scoreTone(score: number) {
  if (score >= 70) return "text-success";
  if (score >= 50) return "text-warning";
  return "text-danger";
}
