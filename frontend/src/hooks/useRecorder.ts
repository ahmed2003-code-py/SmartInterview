import { useCallback, useEffect, useRef, useState } from "react";

export type RecorderError = "denied" | "no-mic" | "unsupported" | "failed";

export interface Recording {
  blob: Blob;
  durationSec: number;
  /** Loudest level seen (0..1). Near zero means the mic captured silence. */
  peak: number;
  /** Seconds where the input was loud enough to be speech. */
  voicedSec: number;
}

const MIME_TYPES = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg;codecs=opus"];
const BARS = 40;
// RMS level above which a frame counts as speech (silence/room noise sits well below).
const VOICE_RMS = 0.02;

export const recordingSupported = typeof window !== "undefined" && !!navigator.mediaDevices?.getUserMedia && typeof MediaRecorder !== "undefined";

/**
 * Microphone recording for one answer at a time. The mic is released as soon as
 * recording stops, so the browser's recording indicator is only on while answering.
 */
export function useRecorder(maxSeconds: number) {
  const [recording, setRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [levels, setLevels] = useState<number[]>(() => Array(BARS).fill(0));

  const mediaRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const rafRef = useRef<number>(0);
  const timerRef = useRef<number>(0);
  const startRef = useRef(0);
  const peakRef = useRef(0);
  const voicedRef = useRef(0);
  const chunksRef = useRef<Blob[]>([]);
  const stopResolveRef = useRef<((r: Recording | null) => void) | null>(null);
  const autoStopRef = useRef<(() => void) | null>(null);

  const cleanup = useCallback(() => {
    cancelAnimationFrame(rafRef.current);
    window.clearInterval(timerRef.current);
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    audioCtxRef.current?.close().catch(() => {});
    audioCtxRef.current = null;
    setRecording(false);
    setLevels(Array(BARS).fill(0));
  }, []);

  useEffect(() => () => {
    if (mediaRef.current?.state === "recording") mediaRef.current.stop();
    cleanup();
  }, [cleanup]);

  const stop = useCallback(() => {
    return new Promise<Recording | null>((resolve) => {
      const rec = mediaRef.current;
      if (!rec || rec.state !== "recording") return resolve(null);
      stopResolveRef.current = resolve;
      rec.stop();
    });
  }, []);

  const start = useCallback(async (): Promise<RecorderError | null> => {
    if (!recordingSupported) return "unsupported";
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
    } catch (err) {
      const name = (err as DOMException)?.name;
      if (name === "NotAllowedError" || name === "SecurityError") return "denied";
      if (name === "NotFoundError" || name === "OverconstrainedError") return "no-mic";
      return "failed";
    }
    streamRef.current = stream;
    chunksRef.current = [];
    peakRef.current = 0;
    voicedRef.current = 0;

    const mimeType = MIME_TYPES.find((t) => MediaRecorder.isTypeSupported(t));
    const rec = new MediaRecorder(stream, mimeType ? { mimeType, audioBitsPerSecond: 32_000 } : undefined);
    mediaRef.current = rec;
    rec.ondataavailable = (e) => e.data.size && chunksRef.current.push(e.data);
    rec.onstop = () => {
      const durationSec = Math.round((performance.now() - startRef.current) / 1000);
      const blob = new Blob(chunksRef.current, { type: (rec.mimeType || "audio/webm").split(";")[0] });
      cleanup();
      stopResolveRef.current?.({ blob, durationSec, peak: peakRef.current, voicedSec: voicedRef.current });
      stopResolveRef.current = null;
    };

    // Live input levels for the waveform + silence detection.
    try {
      const ctx = new AudioContext();
      audioCtxRef.current = ctx;
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      ctx.createMediaStreamSource(stream).connect(analyser);
      const data = new Uint8Array(analyser.fftSize);
      const history: number[] = Array(BARS).fill(0);
      let frame = 0;
      let last = performance.now();
      const tick = () => {
        const now = performance.now();
        const dt = (now - last) / 1000;
        last = now;
        analyser.getByteTimeDomainData(data);
        let sum = 0;
        for (const v of data) sum += ((v - 128) / 128) ** 2;
        const rms = Math.sqrt(sum / data.length);
        peakRef.current = Math.max(peakRef.current, rms);
        if (rms > VOICE_RMS) voicedRef.current += Math.min(dt, 0.1);
        if (frame++ % 3 === 0) {
          history.shift();
          history.push(Math.min(1, rms * 5));
          setLevels([...history]);
        }
        rafRef.current = requestAnimationFrame(tick);
      };
      tick();
    } catch {
      peakRef.current = 1; // can't measure; don't block on silence detection
      voicedRef.current = Infinity;
    }

    startRef.current = performance.now();
    setElapsed(0);
    timerRef.current = window.setInterval(() => {
      const s = (performance.now() - startRef.current) / 1000;
      setElapsed(s);
      if (s >= maxSeconds) autoStopRef.current?.();
    }, 250);
    rec.start(1000);
    setRecording(true);
    return null;
  }, [cleanup, maxSeconds]);

  return { start, stop, recording, elapsed, levels, setAutoStop: (fn: () => void) => (autoStopRef.current = fn) };
}
