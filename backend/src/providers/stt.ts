import { config } from "../config.js";
import { HttpError } from "../middleware/errors.js";
import { mockTranscript } from "../ai/mock.js";

export type Lang = "en" | "ar";

export interface STTProvider {
  name: string;
  /** `question` gives the model context (helps with domain words); it is not stored. */
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

/**
 * Turns a verbose Whisper result into the answer text.
 * Drops segments Whisper itself marks as probable silence, plus known hallucinated phrases.
 * Thresholds follow Whisper's own silence rule, so normal (even quiet) speech is kept.
 */
export function cleanTranscription(result: VerboseTranscription): string {
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
  if (!text || isHallucination(text)) return "";
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

// A short context prompt helps Whisper with domain words and Arabic/English mixing.
const WHISPER_PROMPT: Record<Lang, string> = {
  en: "A job interview for a teaching position. Classroom management, lesson planning, assessment.",
  ar: "مقابلة عمل لوظيفة تدريس. إدارة الفصل، تخطيط الدروس، التقييم، الطلاب، الـ lesson plan.",
};

/** Groq Whisper (whisper-large-v3-turbo). Audio stays in memory and is discarded after the request. */
const groqWhisper: STTProvider = {
  name: "groq-whisper",
  async transcribe(audio, mimeType, language, question) {
    const form = new FormData();
    form.append("file", new Blob([new Uint8Array(audio)], { type: mimeType }), `answer.${extFor(mimeType)}`);
    form.append("model", config.stt.groqModel);
    form.append("language", language);
    form.append("temperature", "0");
    form.append("response_format", "verbose_json");
    form.append("prompt", question ? `${WHISPER_PROMPT[language]} ${question}`.slice(0, 600) : WHISPER_PROMPT[language]);

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
    return cleanTranscription((await res.json()) as VerboseTranscription);
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
