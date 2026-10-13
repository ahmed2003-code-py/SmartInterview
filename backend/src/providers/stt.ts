import { config } from "../config.js";
import { HttpError } from "../middleware/errors.js";
import { mockTranscript } from "../ai/mock.js";
import { fetchWithRateLimitRetry } from "./http.js";

export type Lang = "en" | "ar";

export interface TranscribeContext {
  /** Role slug, used to add a few relevant vocabulary terms to the prompt. */
  roleSlug?: string;
  /** Current question; only used by the mock provider to pick a matching simulated answer. */
  question?: string;
  /** Client-measured recording length, for debug logs only. */
  durationSec?: number;
}

export interface STTProvider {
  name: string;
  transcribe(audio: Buffer, mimeType: string, language: Lang, ctx?: TranscribeContext): Promise<string>;
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
  compression_ratio?: number;
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
        // Probable silence: Whisper's own rule, plus a very low-confidence segment. On real Egyptian speech the
        // lowest segment avg_logprob we measured was -0.44; invented text on silence scored around -1.7.
        const silent = ((s.no_speech_prob ?? 0) > 0.6 && (s.avg_logprob ?? 0) < -1) || (s.avg_logprob ?? 0) < -1.2;
        // Looping/repetitive segment (very high compression ratio).
        const looping = (s.compression_ratio ?? 0) > 2.6 && (s.avg_logprob ?? 0) < -0.5;
        return !silent && !looping && !isHallucination(s.text);
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

// A short vocabulary/context prompt (never an expected answer). Whisper continues the *style* of its
// prompt: a formal-Arabic prompt made it rewrite Egyptian dialect into فصحى, so the Arabic prompt is
// itself written in Egyptian Arabic (measured on real Egyptian speech: 26.7% -> 25.2% CER, and no more
// dialect-to-MSA rewrites). It also keeps English teaching terms in Latin script.
// The question is not included: on silent audio Whisper echoes or invents text from its context.
const ROLE_TERMS: Record<string, string> = {
  "english-teacher": "speaking, grammar, vocabulary, reading",
  "arabic-teacher": "النحو، الإعراب، القراءة، التعبير",
  "math-teacher": "problem solving, fractions, equations",
  "science-teacher": "experiment, lab, inquiry",
  "kindergarten-teacher": "KG, play-based learning, circle time",
  "special-education-teacher": "IEP, inclusion, autism, ADHD",
  "educational-technology": "LMS, Google Classroom, e-learning",
  "teaching-assistant": "feedback, small groups",
};
const COMMON_TERMS = "lesson plan, classroom management, assessment, group work, primary, secondary";

export function whisperPrompt(language: Lang, roleSlug?: string) {
  const terms = [COMMON_TERMS, roleSlug ? ROLE_TERMS[roleSlug] : ""].filter(Boolean).join(", ");
  return language === "ar"
    ? `ده رد طالب في مقابلة شغل لوظيفة مدرس، بيتكلم بالعامية المصرية وساعات بيقول كلمات إنجليزي زي ${terms}.`
    : `This is a student's answer in a practice interview for a teaching job. Terms may include: ${terms}.`;
}

/** Groq Whisper (whisper-large-v3-turbo). Audio stays in memory and is discarded after the request. */
const groqWhisper: STTProvider = {
  name: "groq-whisper",
  async transcribe(audio, mimeType, language, ctx) {
    const prompt = whisperPrompt(language, ctx?.roleSlug);
    const t0 = Date.now();
    const form = new FormData();
    form.append("file", new Blob([new Uint8Array(audio)], { type: mimeType }), `answer.${extFor(mimeType)}`);
    form.append("model", config.stt.groqModel);
    form.append("language", language);
    form.append("temperature", "0");
    form.append("response_format", "verbose_json");
    form.append("prompt", prompt);

    let res: Response;
    try {
      res = await fetchWithRateLimitRetry("https://api.groq.com/openai/v1/audio/transcriptions", {
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
    const result = (await res.json()) as VerboseTranscription;
    const text = cleanTranscription(result, prompt);
    if (config.stt.debug) {
      // Metadata only, never the audio or the transcript text.
      const segs = result.segments ?? [];
      const avgLogprob = segs.length ? segs.reduce((a, x) => a + (x.avg_logprob ?? 0), 0) / segs.length : null;
      console.log(
        `[stt] model=${config.stt.groqModel} lang=${language} mime=${mimeType} bytes=${audio.length} clientSec=${ctx?.durationSec ?? "?"} audioSec=${result.duration?.toFixed(1) ?? "?"} segments=${segs.length} avgLogprob=${avgLogprob?.toFixed(2) ?? "?"} chars=${text.length} rejected=${!text} ms=${Date.now() - t0}`,
      );
    }
    return text;
  },
};

const mock: STTProvider = {
  name: "mock",
  async transcribe(_audio, _mime, language, ctx) {
    await new Promise((r) => setTimeout(r, 700));
    return mockTranscript(language, ctx?.question);
  },
};

export function getSTT(): STTProvider {
  return config.mockAI ? mock : groqWhisper;
}
