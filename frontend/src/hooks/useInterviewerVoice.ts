import { useCallback, useEffect, useRef, useState } from "react";
import { useSpeech } from "./useSpeech";

export interface SpokenQuestion {
  id: string;
  text: string;
  /** Language the question is in. English → browser voice; Arabic or mixed → ElevenLabs. */
  language: "ar" | "en" | "mixed";
}

/**
 * The interviewer's voice.
 * - English: browser SpeechSynthesis (free, works well).
 * - Arabic: ElevenLabs audio from our backend (the API key never reaches the browser),
 *   falling back to a browser Arabic voice, then to text only.
 * Only one voice ever plays: every new playback cancels the previous one, and a slow audio
 * download for an older question is dropped instead of played.
 */
export function useInterviewerVoice(interviewId: string | undefined, arabicVoice: boolean, onVoiceStart?: () => void) {
  const browserEn = useSpeech("en");
  const browserAr = useSpeech("ar");
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const finishRef = useRef<(() => void) | null>(null);
  const tokenRef = useRef(0);
  const aliveRef = useRef(true);
  const [remoteBroken, setRemoteBroken] = useState(false);
  const [notice, setNotice] = useState(false);
  const remoteAvailable = arabicVoice && !remoteBroken;

  const stopAudio = useCallback(() => {
    const a = audioRef.current;
    audioRef.current = null;
    if (a) {
      a.onended = a.onerror = null;
      a.pause();
      a.removeAttribute("src");
      a.load();
    }
    finishRef.current?.();
    finishRef.current = null;
  }, []);

  const cancel = useCallback(() => {
    tokenRef.current++;
    stopAudio();
    browserEn.cancel();
    browserAr.cancel();
  }, [stopAudio, browserEn, browserAr]);

  useEffect(() => {
    aliveRef.current = true;
    return () => {
      aliveRef.current = false;
      tokenRef.current++;
      stopAudio();
    };
  }, [stopAudio]);

  const playRemote = useCallback(
    async (q: SpokenQuestion, token: number) => {
      if (token !== tokenRef.current || !aliveRef.current) return;
      // The backend streams ElevenLabs audio, so playback starts with the first chunks.
      // Replays hit the browser cache / the server's in-memory cache (no new ElevenLabs call).
      await new Promise<void>((resolve, reject) => {
        const a = new Audio(`/api/interviews/${interviewId}/questions/${q.id}/audio`);
        a.preload = "auto";
        audioRef.current = a;
        let safety = 0;
        const done = () => {
          window.clearTimeout(safety);
          if (audioRef.current === a) audioRef.current = null;
          if (finishRef.current === done) finishRef.current = null;
          resolve();
        };
        finishRef.current = done;
        a.onended = done;
        a.onerror = () => reject(Object.assign(new Error("tts"), { remote: true }));
        a.onplaying = () => {
          onVoiceStart?.();
          // Never wait forever if "ended" doesn't fire (duration may be unknown while streaming).
          window.clearTimeout(safety);
          safety = window.setTimeout(done, (Number.isFinite(a.duration) ? a.duration : 45) * 1000 + 3000);
        };
        a.play().catch((err) => reject(err));
      });
    },
    [interviewId, onVoiceStart],
  );

  /** Speaks a question. Always resolves, even when no voice is available. */
  const speak = useCallback(
    async (q: SpokenQuestion) => {
      cancel();
      const token = tokenRef.current;
      if (!aliveRef.current) return;
      const english = q.language === "en";
      if (!english && remoteAvailable && interviewId) {
        try {
          await playRemote(q, token);
          return;
        } catch (err) {
          if (token !== tokenRef.current || !aliveRef.current) return;
          // Service/quota problems: stop trying ElevenLabs for this visit and tell the student once.
          // (A blocked autoplay is not a service problem, so it doesn't disable the voice.)
          if ((err as { remote?: boolean }).remote) {
            setRemoteBroken(true);
            setNotice(true);
          }
        }
      }
      if (token !== tokenRef.current || !aliveRef.current) return;
      onVoiceStart?.();
      await (english ? browserEn : browserAr).speak(q.text);
    },
    [cancel, remoteAvailable, interviewId, playRemote, browserEn, browserAr],
  );

  return {
    speak,
    cancel,
    /** Whether a question in this language can be heard. */
    canSpeak: (language: SpokenQuestion["language"]) => (language === "en" ? browserEn.supported : remoteAvailable || browserAr.supported),
    /** True once if the Arabic voice service failed and we fell back. */
    notice,
    dismissNotice: () => setNotice(false),
  };
}
