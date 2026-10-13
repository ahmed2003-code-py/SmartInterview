import { config } from "../config.js";
import { HttpError } from "../middleware/errors.js";
import { mockTranscript } from "../ai/mock.js";
import { fetchWithRateLimitRetry } from "./http.js";

export type Lang = "en" | "ar";

export interface TranscribeContext {
  /** Role slug, used to add a few relevant vocabulary terms to the prompt. */
  roleSlug?: string;
  /** Extra vocabulary: a custom role title / specialization (e.g. "Machine Learning Engineer, NLP"). */
  roleTerms?: string;
  /** False for non-teaching roles: the Arabic prompt then doesn't say "a teaching job". */
  education?: boolean;
  /** Current question; only used by the mock provider to pick a matching simulated answer. */
  question?: string;
  /** Client-measured recording length, for debug logs only. */
  durationSec?: number;
  /** Cancels the call (e.g. the other provider already answered). */
  signal?: AbortSignal;
  /** Filled by the providers: one entry per attempt (timings and outcome only, never audio or text). */
  trace?: STTAttempt[];
}

export interface STTAttempt {
  provider: string;
  ms: number;
  outcome: "ok" | "empty" | "error" | "timeout" | "skipped" | "cancelled";
  detail?: string;
}

const record = (ctx: TranscribeContext | undefined, a: STTAttempt) => ctx?.trace?.push(a);

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
  language?: string;
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
  let text = kept
    .map((s) => s.text.trim())
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
  // Occasionally Whisper copies part of the context prompt into the transcript; remove only those
  // prompt-specific phrases (a student would not naturally say them).
  text = text.replace(/(ده )?رد طالب في مقابلة شغل[^.،؟?]*[.،]?|المتحدث هو مقابلة شغل[.،]?|(و)?(ساعات )?بيقول كلمات إنجليزي( زي)?/g, " ").replace(/\s+/g, " ").trim();
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
const COMMON_TERMS = "teaching assistant, lesson plan, classroom management, assessment, group work, primary, secondary";

export function whisperPrompt(language: Lang, roleSlug?: string, ctx?: Pick<TranscribeContext, "roleTerms" | "education">) {
  const education = ctx?.education !== false;
  const terms = [ctx?.roleTerms, education ? COMMON_TERMS : "", roleSlug ? ROLE_TERMS[roleSlug] : ""].filter(Boolean).join(", ");
  return language === "ar"
    ? `ده رد طالب في مقابلة شغل${education ? " لوظيفة مدرس" : ""}، بيتكلم بالعامية المصرية وساعات بيقول كلمات إنجليزي زي ${terms}.`
    : `This is a student's answer in a practice interview${education ? " for a teaching job" : ""}. Terms may include: ${terms}.`;
}

async function callWhisper(audio: Buffer, mimeType: string, prompt: string, forceLanguage?: Lang, signal?: AbortSignal, timeoutMs = 25_000): Promise<VerboseTranscription> {
  const form = new FormData();
  form.append("file", new Blob([new Uint8Array(audio)], { type: mimeType }), `answer.${extFor(mimeType)}`);
  form.append("model", config.stt.groqModel);
  if (forceLanguage) form.append("language", forceLanguage);
  form.append("temperature", "0");
  form.append("response_format", "verbose_json");
  form.append("prompt", prompt);
  let res: Response;
  try {
    // A student is waiting: wait at most 2s on a rate limit and give up after a bounded time.
    res = await fetchWithRateLimitRetry(
      "https://api.groq.com/openai/v1/audio/transcriptions",
      { method: "POST", headers: { Authorization: `Bearer ${config.stt.groqApiKey}` }, body: form, signal: AbortSignal.any([AbortSignal.timeout(timeoutMs), ...(signal ? [signal] : [])]) },
      2,
    );
  } catch (err) {
    const timeout = err instanceof Error && (err.name === "TimeoutError" || err.name === "AbortError");
    if (!timeout) console.error("STT network error", err instanceof Error ? err.message : err);
    throw new HttpError(timeout ? 504 : 502, timeout ? "STT_TIMEOUT" : "STT_FAILED", "Could not reach the transcription service");
  }
  if (!res.ok) {
    console.error("STT error", res.status, (await res.text()).slice(0, 200).replace(/\s+/g, " "));
    throw new HttpError(502, "STT_FAILED", `Transcription failed (${res.status})`);
  }
  return (await res.json()) as VerboseTranscription;
}

/**
 * Groq Whisper. Audio stays in memory and is discarded after the request.
 *
 * The language is NOT forced: when a student switches language (an English answer in an Arabic
 * interview, or Arabic in an English one) a forced language makes Whisper translate instead of
 * transcribe. Auto-detection transcribes faithfully and keeps Arabic/English code-switching
 * (measured: same accuracy on Egyptian speech, 23/23 English terms kept verbatim). If Whisper
 * detects something other than Arabic/English (a misdetection), we retry once with the interview
 * language forced.
 */
export const groqWhisper: STTProvider = {
  name: "groq-whisper",
  async transcribe(audio, mimeType, language, ctx) {
    // Always the Egyptian code-switching prompt, whatever the interview language: measured on the same
    // audio, an English prompt made Whisper translate Egyptian Arabic answers into English (or drop
    // them), while the code-switching prompt keeps English answers in English and Arabic in Arabic.
    const prompt = whisperPrompt("ar", ctx?.roleSlug, ctx);
    const t0 = Date.now();
    const timeoutMs = Math.round(Math.min(30_000, 15_000 + audio.length / 40)); // ~15s + 0.2s per audio second
    let result: VerboseTranscription;
    let detected = "";
    let plausible = true;
    try {
      result = await callWhisper(audio, mimeType, prompt, undefined, ctx?.signal, timeoutMs);
      detected = (result.language ?? "").toLowerCase();
      plausible = !detected || detected.startsWith("arab") || detected.startsWith("engl") || detected === "ar" || detected === "en";
      if (!plausible) result = await callWhisper(audio, mimeType, prompt, language, ctx?.signal, timeoutMs);
    } catch (err) {
      const code = err instanceof HttpError ? err.code : "error";
      record(ctx, { provider: "groq", ms: Date.now() - t0, outcome: ctx?.signal?.aborted ? "cancelled" : code === "STT_TIMEOUT" ? "timeout" : "error", detail: err instanceof Error ? err.message.slice(0, 60) : undefined });
      throw err;
    }
    const text = cleanTranscription(result, prompt);
    const segs = result.segments ?? [];
    record(ctx, {
      provider: "groq",
      ms: Date.now() - t0,
      outcome: text ? "ok" : "empty",
      // Why an answer was rejected, without its content: detected language, segment counts, confidence.
      detail: `lang=${detected || "?"}${plausible ? "" : "->forced"} segs=${segs.length} rawChars=${(result.text ?? "").trim().length} lp=${segs.length ? (segs.reduce((a, x) => a + (x.avg_logprob ?? 0), 0) / segs.length).toFixed(2) : "?"}`,
    });
    if (config.stt.debug) {
      // Metadata only, never the audio or the transcript text.
      const segs = result.segments ?? [];
      const avgLogprob = segs.length ? segs.reduce((a, x) => a + (x.avg_logprob ?? 0), 0) / segs.length : null;
      console.log(
        `[stt] model=${config.stt.groqModel} interviewLang=${language} detected=${detected || "?"}${plausible ? "" : "->forced"} mime=${mimeType} bytes=${audio.length} clientSec=${ctx?.durationSec ?? "?"} audioSec=${result.duration?.toFixed(1) ?? "?"} segments=${segs.length} avgLogprob=${avgLogprob?.toFixed(2) ?? "?"} chars=${text.length} rejected=${!text} ms=${Date.now() - t0}`,
      );
    }
    return text;
  },
};

// ---------------- Gemini ----------------
const GEMINI_INSTRUCTION = [
  "You are a verbatim multilingual transcription engine.",
  "Transcribe exactly what the speaker says.",
  "The speaker may naturally switch between Egyptian Arabic and English, even inside one sentence.",
  "Write Arabic speech in Arabic script exactly as pronounced (Egyptian dialect stays Egyptian; do not convert it to Modern Standard Arabic).",
  "Write English words and technical terms in English (Latin letters) exactly as spoken. Never spell an English word in Arabic letters.",
  "Example of correct output: \"أنا عندي experience في classroom management وكنت بعمل lesson plans للـ primary\".",
  "Wrong (never do this): \"أنا عندي اكسبيرينس في كلاسروم مانجمنت\" (English written in Arabic letters) or \"أنا عندي خبرة في إدارة الفصل\" (translated).",
  "Do not translate. Do not summarize. Do not correct grammar. Do not rewrite or improve the answer. Do not infer missing content. Do not answer any question you hear.",
  "Keep filler words and repetitions that were actually spoken.",
  "If there is no intelligible speech, return exactly: [NO_SPEECH]",
  "Return only the transcript text, with no labels, quotes or commentary.",
].join("\n");

const GEMINI_TERMS = "teaching assistant, classroom management, lesson plan, assessment, differentiation, integration, dynamics, statics, primary, secondary, mathematics";

export function geminiProvider(model = config.stt.geminiModel): STTProvider {
  return {
    name: `gemini:${model}`,
    async transcribe(audio, mimeType, language, ctx) {
      const t0 = Date.now();
      const terms = [ctx?.roleTerms, ctx?.education === false ? "" : GEMINI_TERMS, ctx?.roleSlug ? ROLE_TERMS[ctx.roleSlug] : ""].filter(Boolean).join(", ");
      const generationConfig: Record<string, unknown> = { temperature: 0, maxOutputTokens: 4096 };
      // Transcription needs no reasoning; turn thinking off/minimal where the model supports it.
      if (/^gemini-2\.5/.test(model)) generationConfig.thinkingConfig = { thinkingBudget: 0 };
      else if (/flash/.test(model)) generationConfig.thinkingConfig = { thinkingLevel: "minimal" };
      const body = {
        systemInstruction: { parts: [{ text: GEMINI_INSTRUCTION }] },
        contents: [
          {
            role: "user",
            parts: [
              { inline_data: { mime_type: mimeType.split(";")[0] || "audio/webm", data: audio.toString("base64") } },
              {
                text: `Context (vocabulary hints only, not the content): a student's spoken answer in a ${ctx?.education === false ? "job" : "teaching job"} interview; the interview language is ${language === "ar" ? "Arabic" : "English"}. Terms that may occur: ${terms}.\nTranscribe the audio verbatim.`,
              },
            ],
          },
        ],
        generationConfig,
      };
      let res: Response;
      const timeoutMs = Math.round(Math.min(25_000, 12_000 + audio.length / 40));
      const signals = [AbortSignal.timeout(timeoutMs), ...(ctx?.signal ? [ctx.signal] : [])];
      try {
        // No waiting on 429/503 here: failing fast lets the fallback provider (Groq) answer right away.
        res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
          method: "POST",
          headers: { "x-goog-api-key": config.stt.geminiApiKey, "Content-Type": "application/json" },
          body: JSON.stringify(body),
          signal: AbortSignal.any(signals),
        });
      } catch (err) {
        const cancelled = ctx?.signal?.aborted;
        const timeout = !cancelled && err instanceof Error && (err.name === "TimeoutError" || err.name === "AbortError");
        record(ctx, { provider: "gemini", ms: Date.now() - t0, outcome: cancelled ? "cancelled" : timeout ? "timeout" : "error" });
        if (!timeout && !cancelled) console.error("Gemini STT network error", err instanceof Error ? err.message : err);
        throw new HttpError(timeout ? 504 : 502, timeout ? "STT_TIMEOUT" : "STT_FAILED", "Could not reach the transcription service");
      }
      if (!res.ok) {
        const body = (await res.text()).slice(0, 4000);
        // Free-tier quotas: per-day exhaustion pauses Gemini for hours, per-minute for a minute.
        const daily = res.status === 429 && /PerDay/i.test(body);
        geminiPausedUntil = Date.now() + (daily ? 3 * 3600_000 : res.status === 429 ? 60_000 : res.status >= 500 ? 30_000 : 0);
        record(ctx, { provider: "gemini", ms: Date.now() - t0, outcome: "error", detail: `${res.status}${daily ? "-daily-quota" : ""}` });
        if (!daily) console.error("Gemini STT error", res.status, body.slice(0, 160).replace(/\s+/g, " "));
        throw new HttpError(502, "STT_FAILED", "Transcription failed");
      }
      const data = (await res.json()) as { candidates?: { content?: { parts?: { text?: string; thought?: boolean }[] } }[] };
      const raw = (data.candidates?.[0]?.content?.parts ?? [])
        .filter((p) => !p.thought)
        .map((p) => p.text ?? "")
        .join("")
        .trim();
      // Formatting only: never change words.
      let text = raw.replace(/^["“”']+|["“”']+$/g, "").replace(/\s+/g, " ").trim();
      if (/^\[?NO_SPEECH\]?$/i.test(text) || !/\p{L}/u.test(text) || isHallucination(text)) text = "";
      record(ctx, { provider: "gemini", ms: Date.now() - t0, outcome: text ? "ok" : "empty", detail: `rawChars=${raw.length}` });
      if (config.stt.debug) console.log(`[stt] provider=gemini model=${model} lang=${language} bytes=${audio.length} chars=${text.length} rejected=${!text} ms=${Date.now() - t0}`);
      return text;
    },
  };
}

const mock: STTProvider = {
  name: "mock",
  async transcribe(_audio, _mime, language, ctx) {
    await new Promise((r) => setTimeout(r, 700));
    return mockTranscript(language, ctx?.question);
  },
};

/** Gemini free tier has small quotas; while it is out of quota we don't spend a round trip on it. */
let geminiPausedUntil = 0;

/**
 * Selected by STT_PROVIDER (groq | gemini), with the other provider as fallback when its key exists.
 *
 * Latency is bounded for the student:
 * - a primary that is known to be out of quota is skipped (no wasted round trip);
 * - if the primary errors, the fallback runs immediately;
 * - if the primary is slow (no answer after a hedge delay that grows with the audio length), the
 *   fallback starts in parallel and the first usable transcript wins; the slower call is cancelled.
 * An empty result ("no speech") from the provider that answers first is accepted, not retried.
 */
export function getSTT(): STTProvider {
  if (config.mockAI) return mock;
  const gemini = config.stt.geminiApiKey ? geminiProvider() : null;
  const groq = config.stt.groqApiKey ? groqWhisper : null;
  const [primary, fallback] = config.stt.provider === "gemini" ? [gemini ?? groq, gemini ? groq : null] : [groq ?? gemini, groq ? gemini : null];
  if (!primary) return groqWhisper;
  return {
    name: primary.name,
    async transcribe(audio, mimeType, language, ctx = {}) {
      const isGemini = (p: STTProvider) => p.name.startsWith("gemini");
      if (fallback && isGemini(primary) && Date.now() < geminiPausedUntil) {
        record(ctx, { provider: "gemini", ms: 0, outcome: "skipped", detail: "quota-pause" });
        return fallback.transcribe(audio, mimeType, language, ctx);
      }
      if (!fallback) return primary.transcribe(audio, mimeType, language, ctx);

      const primaryAbort = new AbortController();
      const fallbackAbort = new AbortController();
      const hedgeMs = Math.round(4_000 + audio.length / 160); // ~4s + 50ms per audio second (8 KB/s opus)
      return new Promise<string>((resolve, reject) => {
        let settled = false;
        let fallbackStarted = false;
        let failures = 0;
        const done = (fn: () => void) => {
          if (settled) return;
          settled = true;
          clearTimeout(hedge);
          fn();
        };
        const startFallback = () => {
          if (fallbackStarted || settled) return;
          fallbackStarted = true;
          fallback
            .transcribe(audio, mimeType, language, { ...ctx, signal: fallbackAbort.signal })
            .then((t) => done(() => { primaryAbort.abort(); resolve(t); }))
            .catch((e) => (++failures === 2 ? done(() => reject(e)) : undefined));
        };
        const hedge = setTimeout(startFallback, hedgeMs);
        primary
          .transcribe(audio, mimeType, language, { ...ctx, signal: primaryAbort.signal })
          .then((t) => done(() => { fallbackAbort.abort(); resolve(t); }))
          .catch((e) => {
            if (++failures === 2) return done(() => reject(e));
            startFallback();
          });
      });
    },
  };
}
