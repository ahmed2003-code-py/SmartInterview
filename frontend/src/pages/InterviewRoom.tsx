import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import { AlertCircle, ArrowRight, Keyboard, Lock, Mic, RotateCcw, Send, Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import { Tooltip } from "@/components/ui/tooltip";
import { Dialog, DialogClose, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { ErrorState } from "@/components/ui/states";
import { LogoMark } from "@/components/layout/Logo";
import { ThemeToggle } from "@/components/layout/Preferences";
import { Waveform } from "@/features/interview/Waveform";
import { AiMessage, InterviewerAvatar, StudentMessage, ThinkingMessage } from "@/features/interview/Conversation";
import { useInterviewerVoice } from "@/hooks/useInterviewerVoice";
import { useLiveCaption } from "@/hooks/useLiveCaption";
import { recordingSupported, useRecorder, type Recording, type RecorderError } from "@/hooks/useRecorder";
import { api, ApiError, type AppConfig, type InterviewDTO, type QuestionDTO } from "@/lib/api";
import { I18nOverride, useI18n } from "@/i18n";
import { clockTime, cn, textDir } from "@/lib/utils";

/**
 * READY → AI_SPEAKING → WAITING_FOR_USER → RECORDING → TRANSCRIBING → ANALYZING → AI_SPEAKING …
 * ANSWER_FAILED: the transcript exists but the next question couldn't be prepared (retry reuses it).
 */
export type Phase = "READY" | "AI_SPEAKING" | "WAITING_FOR_USER" | "RECORDING" | "TRANSCRIBING" | "ANALYZING" | "ANSWER_FAILED" | "COMPLETED" | "DONE";

interface RoomError {
  message: string;
  retry?: () => void;
}

// Developer-only stage timing: localStorage.debugTiming = "1" → console table per answer.
const DEBUG_TIMING = (() => {
  try {
    return import.meta.env.DEV || localStorage.getItem("debugTiming") === "1";
  } catch {
    return false;
  }
})();
const marks: Record<string, number> = {};
const mark = (name: string) => DEBUG_TIMING && (marks[name] = performance.now());
function serverTiming(path: string) {
  const e = performance.getEntriesByType("resource").filter((r) => r.name.includes(path)).at(-1) as PerformanceResourceTiming | undefined;
  return Object.fromEntries((e?.serverTiming ?? []).map((t) => [t.name, Math.round(t.duration)]));
}
function reportTiming() {
  if (!DEBUG_TIMING || !marks.stop) return;
  const d = (a: string, b: string) => (marks[a] && marks[b] ? Math.round(marks[b] - marks[a]) : null);
  console.table({
    "stop → audio ready": d("stop", "audioReady"),
    "audio ready → transcript received": d("audioReady", "sttDone"),
    "  of which server STT": serverTiming("/transcribe").stt ?? null,
    "transcript → shown + sent": d("sttDone", "submitted"),
    "sent → next question received": d("submitted", "answerDone"),
    "  of which server AI": serverTiming("/answers").ai ?? null,
    "next question → voice starts": d("answerDone", "voiceStart"),
    "TOTAL stop → voice": d("stop", "voiceStart"),
  });
  for (const k of Object.keys(marks)) delete marks[k];
}

const SILENCE_PEAK = 0.012;
const MIN_VOICED_SEC = 0.4;

/** Loads the interview, then runs the room in the interview's own language (Arabic interview = Arabic RTL room). */
export default function InterviewRoom() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { d } = useI18n();
  const [interview, setInterview] = useState<InterviewDTO | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [config, setConfig] = useState<AppConfig | null>(null);

  const load = useCallback(async () => {
    setLoadFailed(false);
    try {
      const { interview } = await api.get<{ interview: InterviewDTO }>(`/interviews/${id}`);
      if (interview.status === "COMPLETED") {
        navigate(`/interviews/${id}/report`, { replace: true });
        return null;
      }
      setInterview(interview);
      return interview;
    } catch {
      setLoadFailed(true);
      return null;
    }
  }, [id, navigate]);

  useEffect(() => {
    load();
    api.get<AppConfig>("/config").then(setConfig).catch(() => setConfig({ mockAI: false, arabicVoice: false, maxAnswerSeconds: 120, maxJobDescriptionChars: 2500 }));
  }, [load]);

  if (loadFailed)
    return (
      <div className="grid min-h-dvh place-items-center">
        <ErrorState onRetry={load} />
      </div>
    );
  if (!interview || !config)
    return (
      <div className="grid min-h-dvh place-items-center text-muted">
        <Spinner />
      </div>
    );
  if (interview.status === "ABANDONED")
    return (
      <div className="grid min-h-dvh place-items-center px-4 text-center">
        <div>
          <p className="text-muted">{d.room.endedNoReport}</p>
          <Button asChild className="mt-5">
            <Link to="/dashboard">{d.room.backToDashboard}</Link>
          </Button>
        </div>
      </div>
    );

  return (
    <I18nOverride lang={interview.language}>
      <Room interview={interview} setInterview={setInterview} reload={load} config={config} />
    </I18nOverride>
  );
}

function Room({
  interview,
  setInterview,
  reload,
  config,
}: {
  interview: InterviewDTO;
  setInterview: React.Dispatch<React.SetStateAction<InterviewDTO | null>>;
  reload: () => Promise<InterviewDTO | null>;
  config: AppConfig;
}) {
  const id = interview.id;
  const navigate = useNavigate();
  const location = useLocation();
  const { d, fmt, lang } = useI18n(); // the interview's language

  const [phase, setPhase] = useState<Phase>("READY");
  const [error, setError] = useState<RoomError | null>(null);
  const [pending, setPending] = useState<string | null>(null); // transcript being submitted
  const [typed, setTyped] = useState("");
  const [inputMode, setInputMode] = useState<"voice" | "text">(recordingSupported ? "voice" : "text");
  const [slowAnalysis, setSlowAnalysis] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const scrollRef = useRef<HTMLDivElement>(null);

  // Guards so one recording produces exactly one transcription and one submission.
  const startingRef = useRef(false);
  const sttBusyRef = useRef(false);
  const submitBusyRef = useRef(false);
  const autoStartedRef = useRef(false);
  const interviewRef = useRef(interview);
  interviewRef.current = interview;

  const onVoiceStart = useCallback(() => {
    mark("voiceStart");
    reportTiming();
  }, []);
  const voice = useInterviewerVoice(id, config.arabicVoice, onVoiceStart);
  const recorder = useRecorder(config.maxAnswerSeconds);
  const caption = useLiveCaption(); // provisional, display-only

  const current = interview.questions.at(-1);
  const currentQuestion = current && !current.answer ? current : null;
  const answeredCount = interview.questions.filter((q) => q.answer).length;

  useEffect(() => {
    if (phase === "COMPLETED" || phase === "DONE") return;
    const t = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(t);
  }, [phase]);

  useEffect(() => {
    if (phase !== "ANALYZING") return setSlowAnalysis(false);
    const t = window.setTimeout(() => setSlowAnalysis(true), 3500);
    return () => window.clearTimeout(t);
  }, [phase]);

  // Non-blocking notice when the Arabic voice service fails; the interview continues as text.
  useEffect(() => {
    if (!voice.notice) return;
    toast(d.room.voiceFailed);
    voice.dismissNotice();
  }, [voice.notice, voice, d.room.voiceFailed]);

  // ---- flow ----
  const errorText = (err: unknown, fallback: string) => (err instanceof ApiError && err.code === "NETWORK_ERROR" ? d.room.errors.network : fallback);

  const ask = useCallback(
    async (q: QuestionDTO) => {
      setPhase("AI_SPEAKING");
      await voice.speak({ id: q.id, text: q.text, language: q.language ?? interview.language });
      // Only advance if nothing else (e.g. End interview) changed the phase meanwhile.
      setPhase((p) => (p === "AI_SPEAKING" ? "WAITING_FOR_USER" : p));
    },
    [voice],
  );

  async function finish() {
    voice.cancel();
    setError(null);
    setPhase("COMPLETED");
    try {
      const { interview: done } = await api.post<{ interview: InterviewDTO }>(`/interviews/${id}/finish`);
      if (done.status === "COMPLETED") {
        setInterview((prev) => (prev ? { ...prev, status: "COMPLETED" } : prev));
        setPhase("DONE");
      } else {
        toast(d.room.endedNoReport);
        navigate("/dashboard", { replace: true });
      }
    } catch (err) {
      setError({ message: errorText(err, d.room.errors.reportFailed), retry: finish });
    }
  }

  function begin() {
    setError(null);
    if (currentQuestion) ask(currentQuestion);
    else finish(); // every question answered but the interview was never closed
  }

  /** Sends the transcript to the interviewer AI. Retrying reuses the same text; it never re-records. */
  async function submit(text: string) {
    const q = interviewRef.current.questions.at(-1);
    if (submitBusyRef.current || !text.trim() || !q || q.answer) return;
    submitBusyRef.current = true;
    setError(null);
    setPending(text);
    setPhase("ANALYZING");
    mark("submitted");
    try {
      const res = await api.post<{ interview: InterviewDTO; shouldEndInterview: boolean }>(`/interviews/${id}/answers`, {
        questionId: q.id,
        transcript: text.trim(),
        durationSec: lastDurationRef.current ?? undefined,
      });
      mark("answerDone");
      setInterview(res.interview);
      setPending(null);
      setTyped("");
      lastDurationRef.current = null;
      submitBusyRef.current = false;
      if (res.shouldEndInterview) await finish();
      else await ask(res.interview.questions.at(-1)!);
    } catch (err) {
      submitBusyRef.current = false;
      if (err instanceof ApiError && (err.code === "ALREADY_ANSWERED" || err.code === "STALE_QUESTION")) {
        // A duplicate request already handled this answer; resync and carry on.
        setPending(null);
        const fresh = await reload();
        const next = fresh?.questions.at(-1);
        if (next && !next.answer) await ask(next);
      } else if (err instanceof ApiError && err.code === "INTERVIEW_CLOSED") {
        navigate(`/interviews/${id}/report`, { replace: true });
      } else {
        setPhase("ANSWER_FAILED");
        setError({ message: errorText(err, d.room.errors.nextFailed), retry: () => submit(text) });
      }
    }
  }
  const lastDurationRef = useRef<number | null>(null);

  async function transcribe(rec: Recording) {
    if (sttBusyRef.current) return;
    sttBusyRef.current = true;
    setError(null);
    setPhase("TRANSCRIBING");
    const form = new FormData();
    form.append("audio", rec.blob, `answer.${rec.blob.type.includes("mp4") ? "m4a" : rec.blob.type.includes("ogg") ? "ogg" : "webm"}`);
    if (Number.isFinite(rec.voicedSec)) form.append("voicedSec", rec.voicedSec.toFixed(2));
    form.append("durationSec", String(rec.durationSec));
    let transcript: string;
    try {
      ({ transcript } = await api.post<{ transcript: string }>(`/interviews/${id}/transcribe`, form));
    } catch (err) {
      sttBusyRef.current = false;
      setPhase("WAITING_FOR_USER");
      // Nothing is submitted; the student records again (or retries the same audio).
      if (err instanceof ApiError && err.code === "NO_SPEECH") setError({ message: d.room.errors.noSpeech });
      else setError({ message: errorText(err, d.room.errors.sttFailed), retry: () => transcribe(rec) });
      return;
    }
    sttBusyRef.current = false;
    mark("sttDone");
    caption.clear();
    lastDurationRef.current = rec.durationSec;
    // Show what the system understood, then send it straight away.
    await submit(transcript);
  }

  const recorderMessage: Record<RecorderError, string> = {
    denied: d.room.errors.micDenied,
    "no-mic": d.room.errors.noMic,
    unsupported: d.room.errors.unsupported,
    failed: d.room.errors.generic,
  };

  async function startAnswer() {
    if (phase !== "WAITING_FOR_USER" || startingRef.current || recorder.recording) return;
    startingRef.current = true;
    setError(null);
    const err = await recorder.start().finally(() => (startingRef.current = false));
    if (err) {
      setError({ message: recorderMessage[err], retry: err === "failed" ? startAnswer : undefined });
      if (err !== "failed") setInputMode("text");
      return;
    }
    setPhase("RECORDING");
    // Captions: in smart mode follow the language of the student's last answer; otherwise the question's
    // language (mixed → Arabic recognizer, which handles common English terms best).
    const lastAnswer = interview.questions.filter((q) => q.answer).at(-1)?.answer?.transcript;
    const captionLang =
      interview.languageMode === "smart" && lastAnswer ? (textDir(lastAnswer) === "ltr" ? "en" : "ar") : (currentQuestion?.language ?? interview.language) === "en" ? "en" : "ar";
    caption.start(captionLang);
  }

  async function stopAnswer() {
    mark("stop");
    caption.stop();
    const rec = await recorder.stop(); // null for a second Stop click
    if (!rec) return;
    mark("audioReady");
    if (rec.durationSec < 1 || rec.blob.size < 1500) {
      caption.clear();
      setPhase("WAITING_FOR_USER");
      return setError({ message: d.room.errors.tooShort });
    }
    if (rec.peak < SILENCE_PEAK || rec.voicedSec < MIN_VOICED_SEC) {
      caption.clear();
      setPhase("WAITING_FOR_USER");
      return setError({ message: d.room.errors.noSpeech });
    }
    transcribe(rec);
  }
  recorder.setAutoStop(stopAnswer);

  function repeat() {
    if (!currentQuestion || phase !== "WAITING_FOR_USER") return;
    ask(currentQuestion);
  }

  async function endInterview() {
    caption.stop();
    if (recorder.recording) await recorder.stop();
    finish();
  }

  // Arriving from setup: the "Start interview" click already counts as a user gesture,
  // so the first question can be shown and spoken right away.
  // Scheduled after mount settles (and cancelled on unmount) so a dev double-mount can't cancel the first question.
  useEffect(() => {
    const fromSetup = (location.state as { autoStart?: boolean } | null)?.autoStart;
    if (autoStartedRef.current || phase !== "READY" || !fromSetup || answeredCount > 0 || !currentQuestion) return;
    const t = window.setTimeout(() => {
      if (autoStartedRef.current) return;
      autoStartedRef.current = true;
      navigate(location.pathname, { replace: true, state: null });
      begin();
    }, 0);
    return () => window.clearTimeout(t);
  });

  // Keep the newest part of the conversation in view.
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [interview.questions.length, phase, pending, Math.floor(caption.text.length / 60)]);

  // ---- render ----
  const roleName = lang === "ar" ? interview.role.nameAr : interview.role.nameEn;
  const questionNumber = Math.min(currentQuestion?.order ?? interview.questions.length, interview.maxQuestions);
  const elapsed = Math.max(0, Math.floor((now - new Date(interview.startedAt).getTime()) / 1000));
  const statusKey = error?.retry && phase !== "AI_SPEAKING" && phase !== "RECORDING" ? "ERROR" : phase === "ANALYZING" && slowAnalysis ? "PREPARING" : phase;
  const done = phase === "DONE";

  return (
    <div className="flex h-dvh flex-col bg-bg">
      {/* Interview header */}
      <header className="shrink-0 border-b border-border">
        <div className="flex h-14 items-center gap-3 px-4 sm:px-6">
          <Link to="/dashboard" aria-label={d.nav.dashboard} className="shrink-0">
            <LogoMark />
          </Link>
          <span className="h-5 w-px shrink-0 bg-border" />
          <div className="min-w-0">
            <p className="flex items-center gap-2 text-sm font-medium">
              <span className="truncate">{roleName}</span>
              {!done && (
                <span className="hidden shrink-0 items-center gap-1.5 text-xs font-normal text-success sm:flex">
                  <span className="size-1.5 rounded-full bg-current" />
                  {d.room.live}
                </span>
              )}
            </p>
            <p className="truncate text-xs text-subtle">
              {d.levels[interview.difficulty]} · {d.langs[interview.language]}
            </p>
          </div>
          <div className="ms-auto flex shrink-0 items-center gap-1 sm:gap-2">
            {interview.isMock && (
              <Tooltip content={d.common.demoModeHint}>
                <Badge tone="warning" className="hidden md:inline-flex">
                  {d.common.demoMode}
                </Badge>
              </Tooltip>
            )}
            <span className="hidden text-[13px] text-muted sm:inline">{fmt(d.room.questionOf, { n: questionNumber, total: interview.maxQuestions })}</span>
            <span className="text-[13px] text-muted tabular-nums sm:hidden" dir="ltr">
              {questionNumber}/{interview.maxQuestions}
            </span>
            <span className="px-1 text-[13px] text-subtle tabular-nums" dir="ltr">
              {clockTime(elapsed)}
            </span>
            <div className="hidden lg:block">
              <ThemeToggle />
            </div>
            {!done && (
              <Dialog>
                <DialogTrigger asChild>
                  <Button variant="danger" size="sm" className="px-2 sm:px-3" disabled={phase === "COMPLETED"}>
                    {d.room.endInterview}
                  </Button>
                </DialogTrigger>
                <DialogContent title={d.room.endTitle} description={answeredCount ? d.room.endBody : d.room.endBodyNone}>
                  <div className="mt-6 flex justify-end gap-2">
                    <DialogClose asChild>
                      <Button variant="secondary">{d.room.keepGoing}</Button>
                    </DialogClose>
                    <DialogClose asChild>
                      <Button className="bg-danger text-white hover:bg-danger/90" onClick={endInterview}>
                        {d.room.endConfirm}
                      </Button>
                    </DialogClose>
                  </div>
                </DialogContent>
              </Dialog>
            )}
          </div>
        </div>
        <div className="flex h-[3px] gap-px bg-border" aria-hidden>
          {Array.from({ length: interview.maxQuestions }, (_, i) => (
            <span key={i} className={cn("flex-1 transition-colors duration-500", i < answeredCount ? "bg-primary" : i === answeredCount && phase !== "READY" && !done ? "bg-primary/35" : "bg-surface-2")} />
          ))}
        </div>
      </header>

      {/* Conversation */}
      <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
        <div className="mx-auto flex w-full max-w-[44rem] flex-col gap-7 px-4 pt-8 pb-10 sm:px-6 sm:pt-12">
          <div className="text-center text-xs text-subtle">
            <div className="flex items-center gap-3">
              <span className="h-px flex-1 bg-border" />
              {d.room.started}
              <span className="h-px flex-1 bg-border" />
            </div>
            <p className="mx-auto mt-2 flex max-w-md items-start justify-center gap-1.5 text-balance">
              <Lock className="mt-0.5 size-3 shrink-0" />
              {d.room.privacy}
            </p>
          </div>

          {interview.questions.map((q) => {
            const isCurrent = q.id === currentQuestion?.id && !done;
            return (
              <div key={q.id} className="flex flex-col gap-5">
                <AiMessage
                  text={q.text}
                  lang={q.language === "en" ? "en" : "ar"}
                  followUp={q.kind === "FOLLOW_UP"}
                  current={isCurrent}
                  speaking={isCurrent && phase === "AI_SPEAKING"}
                  canReplay={phase === "WAITING_FOR_USER"}
                  onReplay={repeat}
                />
                {q.answer ? (
                  <StudentMessage state="final" text={q.answer.transcript} />
                ) : isCurrent && phase === "RECORDING" ? (
                  <StudentMessage state="recording" recordingTime={clockTime(recorder.elapsed)} caption={caption.text} levels={recorder.levels} />
                ) : isCurrent && phase === "TRANSCRIBING" ? (
                  <StudentMessage state="transcribing" caption={caption.text} />
                ) : isCurrent && pending ? (
                  <StudentMessage state={phase === "ANSWER_FAILED" ? "failed" : "sending"} text={pending} />
                ) : null}
              </div>
            );
          })}

          {phase === "ANALYZING" && <ThinkingMessage />}
          {(phase === "COMPLETED" || done) && (
            <div className="flex animate-fade-up gap-3 sm:gap-4">
              <InterviewerAvatar className="mt-0.5" />
              <div>
                <p className="text-[13px] font-medium">{d.room.interviewer}</p>
                {done ? (
                  <p className="mt-1.5 font-display text-[1.4rem] leading-snug font-[450] sm:text-[1.6rem]">{d.room.closing}</p>
                ) : (
                  <p className="mt-2 flex items-center gap-2 text-sm text-muted">
                    <Spinner className="size-3.5" />
                    {d.room.states.COMPLETED}
                  </p>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Voice dock: only the action that makes sense right now */}
      <footer className="shrink-0 border-t border-border bg-bg pb-[env(safe-area-inset-bottom)]">
        <div className="mx-auto w-full max-w-[44rem] px-4 py-3 sm:px-6 sm:py-4">
          {error && phase !== "ANSWER_FAILED" && (
            <div role="alert" className="mb-3 flex items-start gap-2.5 rounded-md bg-danger-soft px-3 py-2.5 text-sm">
              <AlertCircle className="mt-0.5 size-4 shrink-0 text-danger" />
              <p className="flex-1">{error.message}</p>
              {error.retry && (
                <button className="shrink-0 font-medium text-danger hover:underline" onClick={error.retry}>
                  {d.common.retry}
                </button>
              )}
            </div>
          )}
          <VoiceDock
            phase={phase}
            statusKey={statusKey}
            status={d.room.states[statusKey as keyof typeof d.room.states]}
            error={error}
            inputMode={inputMode}
            canUseMic={recordingSupported}
            typed={typed}
            setTyped={setTyped}
            elapsed={recorder.elapsed}
            maxSeconds={config.maxAnswerSeconds}
            levels={recorder.levels}
            isResuming={answeredCount > 0}
            resumeText={fmt(d.room.resumeBody, { n: questionNumber })}
            reportHref={`/interviews/${id}/report`}
            noTts={!voice.canSpeak(currentQuestion?.language ?? interview.language)}
            onBegin={begin}
            onStart={startAnswer}
            onStop={stopAnswer}
            onSendTyped={() => submit(typed)}
            onToggleMode={() => {
              setError(null);
              setInputMode((m) => (m === "voice" ? "text" : "voice"));
            }}
          />
        </div>
      </footer>
    </div>
  );
}

function VoiceDock(props: {
  phase: Phase;
  statusKey: string;
  status: string;
  error: RoomError | null;
  inputMode: "voice" | "text";
  canUseMic: boolean;
  typed: string;
  setTyped: (v: string) => void;
  elapsed: number;
  maxSeconds: number;
  levels: number[];
  isResuming: boolean;
  resumeText: string;
  reportHref: string;
  noTts: boolean;
  onBegin: () => void;
  onStart: () => void;
  onStop: () => void;
  onSendTyped: () => void;
  onToggleMode: () => void;
}) {
  const { d, fmt } = useI18n();
  const { phase } = props;
  const busy = phase === "TRANSCRIBING" || phase === "ANALYZING" || phase === "COMPLETED";
  const tone =
    props.statusKey === "ERROR" || phase === "RECORDING" || phase === "ANSWER_FAILED"
      ? "text-danger"
      : phase === "AI_SPEAKING"
        ? "text-primary"
        : phase === "WAITING_FOR_USER" || phase === "DONE"
          ? "text-success"
          : "text-muted";

  const status = (
    <div className="min-w-0 flex-1">
      <p className={cn("flex items-center gap-2 text-sm font-medium", tone)} aria-live="polite">
        {busy ? (
          <Spinner className="size-3.5" />
        ) : phase === "AI_SPEAKING" ? (
          <Waveform bars={4} active className="h-3.5 gap-[2px] [&>span]:w-[2px]" />
        ) : (
          <span className={cn("size-2 shrink-0 rounded-full bg-current", phase === "RECORDING" && "animate-pulse")} />
        )}
        <span className="truncate">
          {phase === "READY" ? (props.isResuming ? d.room.resumeTitle : d.room.beginTitle) : phase === "ANSWER_FAILED" ? props.error?.message ?? d.room.errors.nextFailed : props.status}
        </span>
      </p>
      <p className="mt-0.5 truncate text-xs text-subtle">
        {phase === "READY"
          ? props.isResuming
            ? props.resumeText
            : d.room.checklist[0]
          : phase === "WAITING_FOR_USER"
            ? props.noTts
              ? d.room.noTts
              : d.room.checklist[1]
            : busy
              ? d.room.analyzingHint
              : " "}
      </p>
    </div>
  );

  if (phase === "READY")
    return (
      <div className="flex items-center gap-4">
        {status}
        <Button size="lg" onClick={props.onBegin}>
          {props.isResuming ? d.room.resume : d.room.begin}
        </Button>
      </div>
    );

  if (phase === "DONE")
    return (
      <div className="flex items-center gap-4">
        {status}
        <Button asChild size="lg">
          <Link to={props.reportHref}>
            {d.room.viewReport}
            <ArrowRight className="size-4 rtl:-scale-x-100" />
          </Link>
        </Button>
      </div>
    );

  if (phase === "ANSWER_FAILED")
    return (
      <div className="flex items-center gap-4">
        {status}
        <Button size="lg" onClick={props.error?.retry}>
          <RotateCcw className="size-4" />
          {d.common.retry}
        </Button>
      </div>
    );

  if (phase === "RECORDING")
    return (
      <div className="flex items-center gap-3 sm:gap-4">
        <div className="shrink-0">
          <p className="flex items-center gap-2 text-sm font-medium text-danger">
            <span className="size-2 animate-pulse rounded-full bg-current" />
            <span className="tabular-nums" dir="ltr">
              {clockTime(props.elapsed)}
            </span>
          </p>
          <p className="mt-0.5 text-xs text-subtle tabular-nums">{fmt(d.room.timeLeft, { t: clockTime(Math.max(0, props.maxSeconds - props.elapsed)) })}</p>
        </div>
        <Waveform levels={props.levels} bars={props.levels.length} className="h-8 min-w-0 flex-1 justify-between overflow-hidden text-danger/70" />
        <button
          onClick={props.onStop}
          className="relative inline-flex h-12 shrink-0 items-center gap-2 rounded-full bg-danger px-5 text-sm font-medium text-white outline-none transition-transform focus-visible:ring-4 focus-visible:ring-danger/30 active:scale-95"
        >
          <span className="absolute inset-0 rounded-full bg-danger/30 animate-pulse-ring" />
          <Square className="relative size-3.5 fill-current" />
          <span className="relative">{d.room.stopAnswer2}</span>
        </button>
      </div>
    );

  // Typed answers: fallback when the microphone is unavailable or the student prefers typing.
  if (phase === "WAITING_FOR_USER" && props.inputMode === "text")
    return (
      <div>
        <div className="flex items-end gap-2 rounded-lg border border-border-strong/80 bg-surface p-2 focus-within:border-primary">
          <textarea
            value={props.typed}
            onChange={(e) => props.setTyped(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) props.onSendTyped();
            }}
            placeholder={d.room.typePlaceholder}
            dir="auto"
            rows={2}
            maxLength={4000}
            autoFocus
            className="max-h-40 min-h-12 flex-1 resize-none bg-transparent px-2 py-1.5 text-[15px] leading-relaxed outline-none"
            aria-label={d.room.transcriptLabel}
          />
          <Button onClick={props.onSendTyped} disabled={!props.typed.trim()} aria-label={d.room.send}>
            <Send className="size-4 rtl:-scale-x-100" />
            <span className="hidden sm:inline">{d.room.send}</span>
          </Button>
        </div>
        {props.canUseMic && (
          <button onClick={props.onToggleMode} className="mt-2 inline-flex items-center gap-1.5 text-xs text-muted hover:text-fg">
            <Mic className="size-3.5" />
            {d.room.useMic}
          </button>
        )}
      </div>
    );

  // Your turn: one microphone action. Other states show only their status.
  return (
    <div className="flex min-h-12 items-center gap-3 sm:gap-4">
      {status}
      {phase === "WAITING_FOR_USER" && (
        <>
          <Button variant="ghost" size="icon" className="size-11 shrink-0" onClick={props.onToggleMode} aria-label={d.room.typeInstead}>
            <Keyboard className="size-[18px]" />
          </Button>
          <button
            onClick={props.onStart}
            className="inline-flex h-12 shrink-0 items-center gap-2 rounded-full bg-primary px-5 text-sm font-medium text-primary-fg outline-none transition hover:bg-primary-hover focus-visible:ring-4 focus-visible:ring-primary/30 active:scale-95"
          >
            <Mic className="size-[18px]" />
            {d.room.startAnswer}
          </button>
        </>
      )}
    </div>
  );
}
