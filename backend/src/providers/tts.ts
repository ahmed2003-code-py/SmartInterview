import { config } from "../config.js";
import { HttpError } from "../middleware/errors.js";

/**
 * ElevenLabs text-to-speech for Arabic interviewer questions.
 * Audio is cached in memory (keyed by question) so Replay / reloads don't spend characters again;
 * nothing is written to disk or the database.
 */
const CACHE_TTL_MS = 60 * 60 * 1000;
const CACHE_MAX = 60;
const cache = new Map<string, { audio: Buffer; at: number }>();
const inflight = new Map<string, Promise<Buffer>>();

export function ttsConfigured() {
  return Boolean(config.tts.elevenLabsApiKey && config.tts.voiceId);
}

/**
 * Streams a question's audio to the client as ElevenLabs produces it, so playback starts after the
 * first chunks instead of after the whole clip. The full clip is kept in the in-memory cache.
 */
export async function streamQuestionAudio(questionId: string, text: string, sink: { write(chunk: Buffer): void; end(): void }) {
  if (!ttsConfigured()) throw new HttpError(503, "TTS_UNAVAILABLE", "Voice is not configured");
  const hit = cache.get(questionId);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) {
    sink.write(hit.audio);
    return sink.end();
  }
  const pending = inflight.get(questionId);
  if (pending) {
    sink.write(await pending);
    return sink.end();
  }
  let res: Response;
  try {
    res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(config.tts.voiceId)}/stream?output_format=mp3_44100_64`, {
      method: "POST",
      headers: { "xi-api-key": config.tts.elevenLabsApiKey, "Content-Type": "application/json", Accept: "audio/mpeg" },
      body: JSON.stringify({
        text,
        model_id: config.tts.modelId,
        language_code: "ar",
        voice_settings: { stability: 0.6, similarity_boost: 0.75, style: 0, use_speaker_boost: true, speed: 0.95 },
      }),
      signal: AbortSignal.timeout(20_000),
    });
  } catch (err) {
    console.error("TTS network error", err instanceof Error ? err.message : err);
    throw new HttpError(503, "TTS_UNAVAILABLE", "Voice is not available right now");
  }
  if (!res.ok || !res.body) {
    console.error("TTS error", res.status, (await res.text().catch(() => "")).slice(0, 200));
    throw new HttpError(503, "TTS_UNAVAILABLE", "Voice is not available right now");
  }
  const chunks: Buffer[] = [];
  let resolveFull!: (b: Buffer) => void;
  const full = new Promise<Buffer>((r) => (resolveFull = r));
  inflight.set(questionId, full);
  try {
    for await (const chunk of res.body as unknown as AsyncIterable<Uint8Array>) {
      const b = Buffer.from(chunk);
      chunks.push(b);
      sink.write(b);
    }
  } finally {
    const audio = Buffer.concat(chunks);
    inflight.delete(questionId);
    resolveFull(audio);
    if (audio.length) {
      cache.set(questionId, { audio, at: Date.now() });
      while (cache.size > CACHE_MAX) cache.delete(cache.keys().next().value!);
    }
    sink.end();
  }
}
