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

/** Text color class for a 0-100 score: neutral when fine, colored only when it needs attention. */
export function scoreTone(score: number) {
  if (score >= 70) return "text-fg";
  if (score >= 50) return "text-warning";
  return "text-danger";
}

/**
 * Paragraph direction for mixed Arabic/English text by dominant script, so an Arabic sentence that
 * happens to start with an English term ("the weekend… بنزور…") still reads right-to-left.
 */
export function textDir(text: string): "rtl" | "ltr" {
  const ar = (text.match(/[\u0600-\u06FF]/g) ?? []).length;
  const latin = (text.match(/[A-Za-z]/g) ?? []).length;
  return ar >= latin * 0.6 && ar > 0 ? "rtl" : "ltr";
}
