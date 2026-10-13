import { config } from "../config.js";
import { HttpError } from "../middleware/errors.js";
import { mockTranscript } from "../ai/mock.js";

export type Lang = "en" | "ar";

export interface STTProvider {
  name: string;
  /** `question` gives the model context (helps with domain words); it is not stored. */
  transcribe(audio: Buffer, mimeType: string, language: Lang, question?: string): Promise<string>;
}

// Whisper-family models sometimes "hear" these phrases in silence or noise.
const HALLUCINATIONS = [
  /^thank(s| you)( so much)? for watching[.!]?$/i,
  /^(please )?subscribe[.!]?$/i,
  /^you$/i,
  /اشتركوا? في (ال)?قناة/,
  /ترجمة نانسي قنقر/,
  /^شكرا(ً)? (لكم )?(على|علي) (ال)?مشاهدة[.!]?$/,
  /^موسيقى$/,
];

function clean(text: string): string {
  const t = text.replace(/\s+/g, " ").trim();
  if (!t || HALLUCINATIONS.some((re) => re.test(t))) return "";
  return t;
}

function extFor(mimeType: string) {
  if (mimeType.includes("webm")) return "webm";
  if (mimeType.includes("ogg")) return "ogg";
  if (mimeType.includes("mp4") || mimeType.includes("m4a") || mimeType.includes("aac")) return "m4a";
  if (mimeType.includes("wav")) return "wav";
  if (mimeType.includes("mpeg") || mimeType.includes("mp3")) return "mp3";
  return "webm";
}

/** Both Groq Whisper and a vLLM-served Cohere model expose the OpenAI transcription API. */
async function openAICompatibleTranscribe(opts: { url: string; apiKey: string; model: string; audio: Buffer; mimeType: string; language: Lang; prompt?: string }) {
  const form = new FormData();
  form.append("file", new Blob([new Uint8Array(opts.audio)], { type: opts.mimeType }), `answer.${extFor(opts.mimeType)}`);
  form.append("model", opts.model);
  form.append("language", opts.language);
  form.append("response_format", "json");
  form.append("temperature", "0");
  if (opts.prompt) form.append("prompt", opts.prompt);

  let res: Response;
  try {
    res = await fetch(opts.url, {
      method: "POST",
      headers: opts.apiKey ? { Authorization: `Bearer ${opts.apiKey}` } : {},
      body: form,
      signal: AbortSignal.timeout(45_000),
    });
  } catch (err) {
    console.error("STT network error", err);
    throw new HttpError(502, "STT_FAILED", "Could not reach the transcription service");
  }
  if (!res.ok) {
    console.error("STT error", res.status, (await res.text()).slice(0, 500));
    throw new HttpError(502, "STT_FAILED", "Transcription failed");
  }
  const data = (await res.json()) as { text?: string };
  return clean(data.text ?? "");
}

// A short context prompt helps Whisper with domain words and Arabic/English mixing.
const WHISPER_PROMPT: Record<Lang, string> = {
  en: "A job interview for a teaching position. Classroom management, lesson planning, assessment.",
  ar: "مقابلة عمل لوظيفة تدريس. إدارة الفصل، تخطيط الدروس، التقييم، الطلاب، الـ lesson plan.",
};

const groqWhisper: STTProvider = {
  name: "groq-whisper",
  transcribe: (audio, mimeType, language, question) =>
    openAICompatibleTranscribe({
      url: "https://api.groq.com/openai/v1/audio/transcriptions",
      apiKey: config.stt.groqApiKey,
      model: config.stt.groqModel,
      audio,
      mimeType,
      language,
      prompt: question ? `${WHISPER_PROMPT[language]} ${question}`.slice(0, 600) : WHISPER_PROMPT[language],
    }),
};

const cohere: STTProvider = {
  name: "cohere-transcribe",
  transcribe: (audio, mimeType, language) =>
    openAICompatibleTranscribe({ url: config.stt.cohereUrl, apiKey: config.stt.cohereApiKey, model: config.stt.cohereModel, audio, mimeType, language }),
};

const mock: STTProvider = {
  name: "mock",
  async transcribe(_audio, _mime, language, question) {
    await new Promise((r) => setTimeout(r, 700));
    return mockTranscript(language, question);
  },
};

export function getSTT(): STTProvider {
  if (config.mockAI || config.stt.provider === "mock") return mock;
  if (config.stt.provider === "cohere") return cohere;
  return groqWhisper;
}
