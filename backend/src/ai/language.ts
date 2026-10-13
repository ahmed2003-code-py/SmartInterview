import type { SpokenLanguage } from "./types.js";

/** Share of letters that are Arabic script (0..1). */
export function arabicShare(text: string) {
  const ar = (text.match(/[\u0600-\u06FF]/g) ?? []).length;
  const latin = (text.match(/[A-Za-z]/g) ?? []).length;
  return ar + latin ? ar / (ar + latin) : 0;
}

/** Deterministic label for a question's language (used to route TTS and as a safety check). */
export function scriptLanguage(text: string): SpokenLanguage {
  const share = arabicShare(text);
  if (share >= 0.85) return "ar";
  if (share <= 0.15) return "en";
  return share >= 0.5 ? "mixed" : "en";
}

// Explicit requests to switch language, in Arabic (Egyptian / MSA) or English.
const WANTS_EN = [
  /(ب|بال)(ال)?(إ|ا)نجليز(ي|ية|يه)/,
  /\b(in|speak|continue|switch to|ask me in|use)\s+english\b/i,
  /(نكمل|كمل|نتكلم|اتكلم|تكلم|خلينا|نخليها|اسأل(ني)?|السؤال الجاي|رد)[^.؟?!]{0,25}\benglish\b/i,
];
const WANTS_AR = [/(ب|بال)عرب(ي|ية|يه)/, /\b(in|speak|continue|switch to|ask me in|use)\s+arabic\b/i];

/** Detects an explicit "talk to me in English/Arabic" instruction in the student's answer. */
export function detectLanguageRequest(answer: string): "ar" | "en" | null {
  const en = WANTS_EN.some((re) => re.test(answer));
  const ar = WANTS_AR.some((re) => re.test(answer));
  if (en === ar) return null; // none, or ambiguous
  return en ? "en" : "ar";
}
