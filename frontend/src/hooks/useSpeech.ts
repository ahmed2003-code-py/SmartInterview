import { useCallback, useEffect, useRef, useState } from "react";

const supported = typeof window !== "undefined" && "speechSynthesis" in window && "SpeechSynthesisUtterance" in window;

// Preferred voices, best first. Falls back to any voice for the language.
const PREFERRED: Record<"en" | "ar", RegExp[]> = {
  en: [/natural/i, /google us english/i, /samantha/i, /aria|jenny|guy/i, /en-us/i],
  ar: [/ar-eg/i, /salma|shakir/i, /natural/i, /google.*(arabic|عربي)/i, /ar-sa/i],
};

function pickVoice(voices: SpeechSynthesisVoice[], lang: "en" | "ar") {
  const candidates = voices.filter((v) => v.lang.toLowerCase().startsWith(lang));
  for (const re of PREFERRED[lang]) {
    const match = candidates.find((v) => re.test(`${v.name} ${v.lang}`));
    if (match) return match;
  }
  return candidates[0] ?? null;
}

/**
 * Browser text-to-speech for the interviewer voice (free, no API).
 * `speak` always resolves, even if the browser never fires `onend`, so the interview can't get stuck.
 */
export function useSpeech(lang: "en" | "ar") {
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>(() => (supported ? speechSynthesis.getVoices() : []));
  const resolveRef = useRef<(() => void) | null>(null);
  // Set when the engine fails outright (e.g. no voices installed); questions are then text-only.
  const [broken, setBroken] = useState(false);
  // False after the page using this hook unmounts, so late async work (e.g. an answer that finishes
  // after the student left the room) can never start speaking.
  const aliveRef = useRef(true);

  useEffect(() => {
    if (!supported) return;
    aliveRef.current = true;
    const load = () => setVoices(speechSynthesis.getVoices());
    load();
    speechSynthesis.addEventListener("voiceschanged", load);
    return () => {
      aliveRef.current = false;
      speechSynthesis.removeEventListener("voiceschanged", load);
      speechSynthesis.cancel();
    };
  }, []);

  const voice = pickVoice(voices, lang);
  // Speaking Arabic text with an English voice sounds broken, so only speak if a matching voice exists.
  const available = supported && !broken && (voice !== null || voices.length === 0);

  const cancel = useCallback(() => {
    if (supported) speechSynthesis.cancel();
    resolveRef.current?.();
    resolveRef.current = null;
  }, []);

  const speak = useCallback(
    (text: string) =>
      new Promise<void>((resolve) => {
        if (!available || !aliveRef.current) return resolve();
        speechSynthesis.cancel();
        const u = new SpeechSynthesisUtterance(text);
        u.lang = voice?.lang ?? (lang === "ar" ? "ar-EG" : "en-US");
        if (voice) u.voice = voice;
        u.rate = lang === "ar" ? 0.95 : 1;

        let keepAlive: number | undefined;
        let safety: number | undefined;
        const done = () => {
          window.clearInterval(keepAlive);
          window.clearTimeout(safety);
          if (resolveRef.current === done) resolveRef.current = null;
          resolve();
        };
        resolveRef.current = done;
        u.onend = done;
        u.onerror = (e) => {
          if (e.error !== "interrupted" && e.error !== "canceled" && e.error !== "not-allowed") setBroken(true);
          done();
        };
        // Chrome silently stops long utterances after ~15s unless nudged.
        keepAlive = window.setInterval(() => {
          if (speechSynthesis.speaking && !speechSynthesis.paused) {
            speechSynthesis.pause();
            speechSynthesis.resume();
          }
        }, 10_000);
        // Never wait forever if onend doesn't fire.
        const words = text.split(/\s+/).length;
        safety = window.setTimeout(done, 4000 + words * 600);
        speechSynthesis.speak(u);
      }),
    [available, voice, lang],
  );

  return { supported: available, speak, cancel };
}
