import { config } from "../config.js";
import { HttpError } from "../middleware/errors.js";
import { mockTranscript } from "../ai/mock.js";

export type Lang = "en" | "ar";

export interface STTProvider {
  name: string;
  /** `question` is only used by the mock provider to pick a matching simulated answer. */
  transcribe(audio: Buffer, mimeType: string, language: Lang, question?: string): Promise<string>;
}

// Phrases Whisper tends to "hear" in silence or background noise.
const HALLUCINATIONS = [
  /^(thank(s| you)( so much)?( for watching| for listening)?|thanks for watching)[.!]?$/i,
  /^(please )?(like and )?subscribe[.!]?$/i,
  /^(you|bye|okay)[.!]?$/i,
  /^\[?(music|silence|applause|blank_audio)\]?$/i,
  /اشتركوا? في (ال)?قناة/,
  /ترجمة نانسي قنقر/,
  /^شكرا(ً)?( لكم| جزيلا)?( (على|علي) (ال)?مشاهدة)?[.!]?$/,
  /^(موسيقى|سبحان الله)[.!]?$/,
];

const isHallucination = (text: string) => HALLUCINATIONS.some((re) => re.test(text.trim()));

interface VerboseSegment {
  text: string;
  avg_logprob?: number;
  no_speech_prob?: number;
}

interface VerboseTranscription {
  text?: string;
  duration?: number;
  segments?: VerboseSegment[];
}

const normalize = (t: string) => t.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();

/**
 * Turns a verbose Whisper result into the answer text. Rejects (returns ""):
 * - segments Whisper marks as probable silence (Whisper's own rule, so quiet speech is kept)
 * - known hallucinated phrases ("Thank you for watching", subtitle credits, ...)
 * - output with no letters at all (".", "...")
 * - an echo of the context prompt, which Whisper produces on silent audio
 */
export function cleanTranscription(result: VerboseTranscription, prompt = ""): string {
  const segments = result.segments ?? [];
  const kept = segments.length
    ? segments.filter((s) => {
        const silent = (s.no_speech_prob ?? 0) > 0.6 && (s.avg_logprob ?? 0) < -1;
        return !silent && !isHallucination(s.text);
      })
    : [{ text: result.text ?? "" }];
  const text = kept
    .map((s) => s.text.trim())
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
  if (!text || isHallucination(text) || !/\p{L}/u.test(text)) return "";
  const n = normalize(text);
  if (prompt && n.length > 1 && normalize(prompt).includes(n)) return "";
  return text;
}

function extFor(mimeType: string) {
  if (mimeType.includes("webm")) return "webm";
  if (mimeType.includes("ogg")) return "ogg";
  if (mimeType.includes("mp4") || mimeType.includes("m4a") || mimeType.includes("aac")) return "m4a";
  if (mimeType.includes("wav")) return "wav";
  if (mimeType.includes("mpeg") || mimeType.includes("mp3")) return "mp3";
  return "webm";
}

// A short, fixed domain prompt keeps English teaching terms in Latin script inside Arabic answers
// ("lesson plan", "group work"). The question itself is not included: on silent audio Whisper
// tends to echo or invent text from whatever context it was given.
const WHISPER_PROMPT: Record<Lang, string> = {
  en: "A job interview for a teaching position. Classroom management, lesson planning, assessment.",
  ar: "مقابلة عمل لوظيفة تدريس. إدارة الفصل، تخطيط الدروس، التقييم، الطلاب، الـ lesson plan.",
};

/** Groq Whisper (whisper-large-v3-turbo). Audio stays in memory and is discarded after the request. */
const groqWhisper: STTProvider = {
  name: "groq-whisper",
  async transcribe(audio, mimeType, language) {
    const prompt = WHISPER_PROMPT[language];
    const form = new FormData();
    form.append("file", new Blob([new Uint8Array(audio)], { type: mimeType }), `answer.${extFor(mimeType)}`);
    form.append("model", config.stt.groqModel);
    form.append("language", language);
    form.append("temperature", "0");
    form.append("response_format", "verbose_json");
    form.append("prompt", prompt);

    let res: Response;
    try {
      res = await fetch("https://api.groq.com/openai/v1/audio/transcriptions", {
        method: "POST",
        headers: { Authorization: `Bearer ${config.stt.groqApiKey}` },
        body: form,
        signal: AbortSignal.timeout(45_000),
      });
    } catch (err) {
      console.error("STT network error", err instanceof Error ? err.message : err);
      throw new HttpError(502, "STT_FAILED", "Could not reach the transcription service");
    }
    if (!res.ok) {
      console.error("STT error", res.status, (await res.text()).slice(0, 300));
      throw new HttpError(502, "STT_FAILED", "Transcription failed");
    }
    return cleanTranscription((await res.json()) as VerboseTranscription, prompt);
  },
};

const mock: STTProvider = {
  name: "mock",
  async transcribe(_audio, _mime, language, question) {
    await new Promise((r) => setTimeout(r, 700));
    return mockTranscript(language, question);
  },
};

export function getSTT(): STTProvider {
  return config.mockAI ? mock : groqWhisper;
}
