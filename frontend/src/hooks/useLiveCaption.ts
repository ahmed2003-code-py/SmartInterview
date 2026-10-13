import { useCallback, useEffect, useRef, useState } from "react";

/* Minimal typing for the (prefixed) Web Speech recognition API. */
interface RecognitionResult {
  isFinal: boolean;
  0: { transcript: string };
}
interface RecognitionEvent {
  resultIndex: number;
  results: ArrayLike<RecognitionResult>;
}
interface Recognition {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((e: RecognitionEvent) => void) | null;
  onend: (() => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}
type RecognitionCtor = new () => Recognition;

// On phones (Android / iOS) the browser's recognizer plays a system "beep" every time it (re)starts
// and takes the microphone away from the recorder, so captions are desktop-only.
const isMobile =
  typeof navigator !== "undefined" &&
  ((navigator as Navigator & { userAgentData?: { mobile?: boolean } }).userAgentData?.mobile === true || /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent));

const AnyCtor: RecognitionCtor | undefined =
  typeof window !== "undefined" ? ((window as unknown as { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor }).SpeechRecognition ?? (window as unknown as { webkitSpeechRecognition?: RecognitionCtor }).webkitSpeechRecognition) : undefined;
const Ctor: RecognitionCtor | undefined = isMobile ? undefined : AnyCtor;

/**
 * Provisional, display-only captions while the student speaks (progressive enhancement).
 * Never submitted or evaluated: after Stop the authoritative server transcript replaces it.
 * If the browser has no speech recognition, or it errors, `text` simply stays empty.
 */
export function useLiveCaption() {
  const [text, setText] = useState("");
  const recRef = useRef<Recognition | null>(null);
  const activeRef = useRef(false);
  const finalRef = useRef("");
  const restartsRef = useRef(0);

  const stop = useCallback(() => {
    activeRef.current = false;
    const r = recRef.current;
    recRef.current = null;
    if (r) {
      r.onresult = r.onend = r.onerror = null;
      try {
        r.abort();
      } catch {
        /* ignore */
      }
    }
  }, []);

  const start = useCallback(
    (lang: "ar" | "en") => {
      stop();
      setText("");
      finalRef.current = "";
      restartsRef.current = 0;
      if (!Ctor) return;
      activeRef.current = true;
      const begin = () => {
        if (!activeRef.current) return;
        let r: Recognition;
        try {
          r = new Ctor();
        } catch {
          return;
        }
        r.lang = lang === "ar" ? "ar-EG" : "en-US";
        r.continuous = true;
        r.interimResults = true;
        r.onresult = (e) => {
          let interim = "";
          for (let i = e.resultIndex; i < e.results.length; i++) {
            const res = e.results[i];
            if (res.isFinal) finalRef.current += `${res[0].transcript} `;
            else interim += res[0].transcript;
          }
          setText(`${finalRef.current}${interim}`.trim());
        };
        // Chrome ends recognition after pauses; keep listening while the answer is being recorded.
        r.onend = () => {
          // Keep listening across pauses, but never loop endlessly.
          if (activeRef.current && restartsRef.current++ < 20) window.setTimeout(begin, 150);
        };
        r.onerror = (e) => {
          if (e.error === "not-allowed" || e.error === "service-not-allowed" || e.error === "language-not-supported") activeRef.current = false;
        };
        recRef.current = r;
        try {
          r.start();
        } catch {
          /* already started / unsupported */
        }
      };
      begin();
    },
    [stop],
  );

  useEffect(() => stop, [stop]);

  return { text, start, stop, supported: Boolean(Ctor), clear: () => setText("") };
}
