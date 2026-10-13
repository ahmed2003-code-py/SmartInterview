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

async function synthesize(text: string): Promise<Buffer> {
  let res: Response;
  try {
    res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(config.tts.voiceId)}?output_format=mp3_44100_64`, {
      method: "POST",
      headers: { "xi-api-key": config.tts.elevenLabsApiKey, "Content-Type": "application/json", Accept: "audio/mpeg" },
      body: JSON.stringify({
        text,
        model_id: config.tts.modelId,
        language_code: "ar",
        // Calm, steady interviewer delivery.
        voice_settings: { stability: 0.6, similarity_boost: 0.75, style: 0, use_speaker_boost: true, speed: 0.95 },
      }),
      signal: AbortSignal.timeout(20_000),
    });
  } catch (err) {
    console.error("TTS network error", err instanceof Error ? err.message : err);
    throw new HttpError(503, "TTS_UNAVAILABLE", "Voice is not available right now");
  }
  if (!res.ok) {
    // Status only (401 bad key, 402/429 quota or rate limit); never log the key or the text.
    console.error("TTS error", res.status, (await res.text()).slice(0, 200));
    throw new HttpError(503, "TTS_UNAVAILABLE", "Voice is not available right now");
  }
  return Buffer.from(await res.arrayBuffer());
}

/** Returns MP3 audio for a question, generating it at most once while cached. */
export async function questionAudio(questionId: string, text: string): Promise<Buffer> {
  if (!ttsConfigured()) throw new HttpError(503, "TTS_UNAVAILABLE", "Voice is not configured");
  const hit = cache.get(questionId);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.audio;
  // Concurrent requests for the same question share one ElevenLabs call.
  let job = inflight.get(questionId);
  if (!job) {
    job = synthesize(text).finally(() => inflight.delete(questionId));
    inflight.set(questionId, job);
  }
  const audio = await job;
  cache.set(questionId, { audio, at: Date.now() });
  while (cache.size > CACHE_MAX) cache.delete(cache.keys().next().value!);
  return audio;
}
