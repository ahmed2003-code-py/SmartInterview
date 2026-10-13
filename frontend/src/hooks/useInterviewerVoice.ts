import { useCallback, useEffect, useRef, useState } from "react";
import { useSpeech } from "./useSpeech";

export interface SpokenQuestion {
  id: string;
  text: string;
}

/**
 * The interviewer's voice.
 * - English: browser SpeechSynthesis (free, works well).
 * - Arabic: ElevenLabs audio from our backend (the API key never reaches the browser),
 *   falling back to a browser Arabic voice, then to text only.
 * Only one voice ever plays: every new playback cancels the previous one, and a slow audio
 * download for an older question is dropped instead of played.
 */
export function useInterviewerVoice(lang: "en" | "ar", interviewId: string | undefined, arabicVoice: boolean) {
  const browser = useSpeech(lang);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const finishRef = useRef<(() => void) | null>(null);
  const urls = useRef(new Map<string, string>()); // in-memory only, per page visit
  const tokenRef = useRef(0);
  const aliveRef = useRef(true);
  const [remoteBroken, setRemoteBroken] = useState(false);
  const [notice, setNotice] = useState(false);
  const useRemote = lang === "ar" && arabicVoice && !remoteBroken;

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
    browser.cancel();
  }, [stopAudio, browser]);

  useEffect(() => {
    aliveRef.current = true;
    const cached = urls.current;
    return () => {
      aliveRef.current = false;
      tokenRef.current++;
      stopAudio();
      cached.forEach((u) => URL.revokeObjectURL(u));
      cached.clear();
    };
  }, [stopAudio]);

  const playRemote = useCallback(
    async (q: SpokenQuestion, token: number) => {
      let url = urls.current.get(q.id);
      if (!url) {
        const res = await fetch(`/api/interviews/${interviewId}/questions/${q.id}/audio`, { credentials: "include" });
        if (!res.ok) throw Object.assign(new Error("tts"), { remote: true });
        url = URL.createObjectURL(await res.blob());
        urls.current.set(q.id, url);
      }
      if (token !== tokenRef.current || !aliveRef.current) return; // superseded while downloading
      await new Promise<void>((resolve, reject) => {
        const a = new Audio(url);
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
        a.onerror = () => reject(Object.assign(new Error("play"), { remote: true }));
        a.onloadedmetadata = () => {
          // Never wait forever if "ended" doesn't fire.
          safety = window.setTimeout(done, (Number.isFinite(a.duration) ? a.duration : 30) * 1000 + 3000);
        };
        a.play().catch((err) => reject(err));
      });
    },
    [interviewId],
  );

  /** Speaks a question. Always resolves, even when no voice is available. */
  const speak = useCallback(
    async (q: SpokenQuestion) => {
      cancel();
      const token = tokenRef.current;
      if (!aliveRef.current) return;
      if (useRemote && interviewId) {
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
      await browser.speak(q.text);
    },
    [cancel, useRemote, interviewId, playRemote, browser],
  );

  return {
    speak,
    cancel,
    supported: useRemote || browser.supported,
    /** True once if the Arabic voice service failed and we fell back. */
    notice,
    dismissNotice: () => setNotice(false),
  };
}
