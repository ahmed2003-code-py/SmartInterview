import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import { AlertCircle, Keyboard, Lock, Mic, Square, Volume2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { Tooltip } from "@/components/ui/tooltip";
import { Dialog, DialogClose, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { ErrorState } from "@/components/ui/states";
import { LogoMark } from "@/components/layout/Logo";
import { LanguageSwitch, ThemeToggle } from "@/components/layout/Preferences";
import { Waveform } from "@/features/interview/Waveform";
import { TranscriptPanel } from "@/features/interview/TranscriptPanel";
import { useSpeech } from "@/hooks/useSpeech";
import { recordingSupported, useRecorder, type Recording, type RecorderError } from "@/hooks/useRecorder";
import { api, ApiError, type AppConfig, type InterviewDTO } from "@/lib/api";
import { useI18n } from "@/i18n";
import { clockTime, cn } from "@/lib/utils";

export type Phase = "READY" | "AI_SPEAKING" | "WAITING_FOR_USER" | "RECORDING" | "TRANSCRIBING" | "REVIEW" | "ANALYZING" | "COMPLETED";

interface RoomError {
  message: string;
  retry?: () => void;
}

const SILENCE_PEAK = 0.012;

export default function InterviewRoom() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { d, fmt, lang: uiLang } = useI18n();

  const [interview, setInterview] = useState<InterviewDTO | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [phase, setPhase] = useState<Phase>("READY");
  const [error, setError] = useState<RoomError | null>(null);
  const [draft, setDraft] = useState("");
  const [inputMode, setInputMode] = useState<"voice" | "text">(recordingSupported ? "voice" : "text");
  const [slowAnalysis, setSlowAnalysis] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  // Refs keep retry callbacks from reading stale values.
  const interviewRef = useRef<InterviewDTO | null>(null);
  const draftRef = useRef("");
  const recordingRef = useRef<Recording | null>(null);
  const busyRef = useRef(false);
  interviewRef.current = interview;
  draftRef.current = draft;

  const language = interview?.language ?? "en";
  const speech = useSpeech(language);
  const recorder = useRecorder(config?.maxAnswerSeconds ?? 120);

  const current = interview?.questions.at(-1);
  const currentQuestion = current && !current.answer ? current : null;
  const answeredCount = interview?.questions.filter((q) => q.answer).length ?? 0;

  // ---- loading ----
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
    api.get<AppConfig>("/config").then(setConfig).catch(() => {});
  }, [load]);

  useEffect(() => {
    if (phase === "COMPLETED") return;
    const t = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(t);
  }, [phase]);

  useEffect(() => {
    if (phase !== "ANALYZING") return setSlowAnalysis(false);
    const t = window.setTimeout(() => setSlowAnalysis(true), 3500);
    return () => window.clearTimeout(t);
  }, [phase]);

  // ---- flow ----
  const errorText = (err: unknown, fallback: string) => (err instanceof ApiError && err.code === "NETWORK_ERROR" ? d.room.errors.network : fallback);

  const ask = useCallback(
    async (text: string, after: Phase = "WAITING_FOR_USER") => {
      setPhase("AI_SPEAKING");
      await speech.speak(text);
      // Only advance if nothing else (e.g. End interview) changed the phase meanwhile.
      setPhase((p) => (p === "AI_SPEAKING" ? after : p));
    },
    [speech],
  );

  async function finish() {
    speech.cancel();
    setError(null);
    setPhase("COMPLETED");
    try {
      const { interview: done } = await api.post<{ interview: InterviewDTO }>(`/interviews/${id}/finish`);
      if (done.status === "COMPLETED") navigate(`/interviews/${id}/report`, { replace: true });
      else {
        toast(d.room.endedNoReport);
        navigate("/dashboard", { replace: true });
      }
    } catch (err) {
      setError({ message: errorText(err, d.room.errors.reportFailed), retry: finish });
    }
  }

  function begin() {
    setError(null);
    if (currentQuestion) ask(currentQuestion.text);
    else finish(); // every question answered but the interview was never closed
  }

  async function transcribe(rec: Recording) {
    setError(null);
    setPhase("TRANSCRIBING");
    const form = new FormData();
    form.append("audio", rec.blob, `answer.${rec.blob.type.includes("mp4") ? "m4a" : rec.blob.type.includes("ogg") ? "ogg" : "webm"}`);
    try {
      const { transcript } = await api.post<{ transcript: string }>(`/interviews/${id}/transcribe`, form);
      setDraft(transcript);
      setPhase("REVIEW");
    } catch (err) {
      setPhase("WAITING_FOR_USER");
      if (err instanceof ApiError && err.code === "NO_SPEECH") setError({ message: d.room.errors.noSpeech });
      else setError({ message: errorText(err, d.room.errors.sttFailed), retry: () => transcribe(rec) });
    }
  }

  const recorderMessage: Record<RecorderError, string> = {
    denied: d.room.errors.micDenied,
    "no-mic": d.room.errors.noMic,
    unsupported: d.room.errors.unsupported,
    failed: d.room.errors.generic,
  };

  async function startAnswer() {
    if (phase !== "WAITING_FOR_USER" && phase !== "REVIEW") return;
    setError(null);
    const err = await recorder.start();
    if (err) {
      setError({ message: recorderMessage[err], retry: err === "failed" ? startAnswer : undefined });
      if (err !== "failed") setInputMode("text");
      return;
    }
    setDraft("");
    setPhase("RECORDING");
  }

  async function stopAnswer() {
    const rec = await recorder.stop();
    if (!rec) return;
    if (rec.durationSec < 1 || rec.blob.size < 1500) {
      setPhase("WAITING_FOR_USER");
      return setError({ message: d.room.errors.tooShort });
    }
    if (rec.peak < SILENCE_PEAK) {
      setPhase("WAITING_FOR_USER");
      return setError({ message: d.room.errors.noSpeech });
    }
    recordingRef.current = rec;
    transcribe(rec);
  }
  recorder.setAutoStop(stopAnswer);

  async function submit() {
    const text = draftRef.current.trim();
    const q = interviewRef.current?.questions.at(-1);
    if (busyRef.current || !text || !q || q.answer) return;
    busyRef.current = true;
    setError(null);
    setPhase("ANALYZING");
    try {
      const res = await api.post<{ interview: InterviewDTO; shouldEndInterview: boolean }>(`/interviews/${id}/answers`, {
        questionId: q.id,
        transcript: text,
        durationSec: recordingRef.current?.durationSec,
      });
      setInterview(res.interview);
      setDraft("");
      recordingRef.current = null;
      if (res.shouldEndInterview) await finish();
      else await ask(res.interview.questions.at(-1)!.text);
    } catch (err) {
      if (err instanceof ApiError && (err.code === "ALREADY_ANSWERED" || err.code === "STALE_QUESTION")) {
        // Another tab or a double submit already handled it; resync and carry on.
        const fresh = await load();
        const next = fresh?.questions.at(-1);
        if (next && !next.answer) await ask(next.text);
      } else if (err instanceof ApiError && err.code === "INTERVIEW_CLOSED") {
        navigate(`/interviews/${id}/report`, { replace: true });
      } else {
        setPhase("REVIEW");
        setError({ message: errorText(err, d.room.errors.aiFailed), retry: submit });
      }
    } finally {
      busyRef.current = false;
    }
  }

  async function repeat() {
    if (!currentQuestion || (phase !== "WAITING_FOR_USER" && phase !== "REVIEW")) return;
    ask(currentQuestion.text, phase);
  }

  async function endInterview() {
    if (recorder.recording) await recorder.stop();
    finish();
  }

  // ---- render ----
  if (loadFailed)
    return (
      <div className="grid min-h-dvh place-items-center">
        <ErrorState onRetry={load} />
      </div>
    );
  if (!interview)
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

  const roleName = uiLang === "ar" ? interview.role.nameAr : interview.role.nameEn;
  const questionNumber = currentQuestion?.order ?? interview.questions.length;
  const elapsed = Math.max(0, Math.floor((now - new Date(interview.startedAt).getTime()) / 1000));
  const maxSeconds = config?.maxAnswerSeconds ?? 120;
  const statusKey = error?.retry && phase !== "AI_SPEAKING" && phase !== "RECORDING" ? "ERROR" : phase === "ANALYZING" && slowAnalysis ? "PREPARING" : phase;
  const isResuming = answeredCount > 0;

  return (
    <div className="flex min-h-dvh flex-col bg-bg lg:h-dvh">
      {/* Top bar: interview metadata only, no app navigation while interviewing */}
      <header className="flex h-14 shrink-0 items-center gap-3 border-b border-border px-4 sm:px-6">
        <Link to="/dashboard" aria-label={d.nav.dashboard} className="shrink-0">
          <LogoMark />
        </Link>
        <span className="h-5 w-px shrink-0 bg-border" />
        <div className="flex min-w-0 items-baseline gap-2">
          <p className="truncate text-sm font-medium">{roleName}</p>
          <p className="hidden truncate text-[13px] text-subtle sm:block">
            {d.levels[interview.difficulty]} · {d.langs[interview.language]}
          </p>
        </div>
        <div className="ms-auto flex items-center gap-1 sm:gap-2">
          {interview.isMock && (
            <Tooltip content={d.common.demoModeHint}>
              <Badge tone="warning" className="hidden sm:inline-flex">
                {d.common.demoMode}
              </Badge>
            </Tooltip>
          )}
          <span className="px-1 text-[13px] text-muted tabular-nums" dir="ltr" aria-label="elapsed">
            {clockTime(elapsed)}
          </span>
          <div className="hidden items-center sm:flex">
            <LanguageSwitch compact />
            <ThemeToggle />
          </div>
          <Dialog>
            <DialogTrigger asChild>
              <Button variant="danger" size="sm" disabled={phase === "COMPLETED"}>
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
        </div>
      </header>

      {/* Progress: a hairline across the top of the stage */}
      <div className="flex h-[3px] shrink-0 gap-px bg-border" aria-hidden>
        {Array.from({ length: interview.maxQuestions }, (_, i) => (
          <span key={i} className={cn("flex-1 transition-colors duration-500", i < answeredCount ? "bg-primary" : i === answeredCount && phase !== "READY" ? "bg-primary/35" : "bg-surface-2")} />
        ))}
      </div>

      <div className="grid flex-1 lg:min-h-0 lg:grid-cols-[minmax(0,1fr)_380px] xl:grid-cols-[minmax(0,1fr)_420px]">
        <main className="flex flex-col lg:min-h-0 lg:overflow-y-auto">
          <div className="mx-auto flex w-full max-w-[44rem] flex-1 flex-col px-4 pt-7 pb-6 sm:px-8 lg:pt-14">
            <p className="text-[13px] text-subtle tabular-nums">
              {fmt(d.room.questionOf, { n: Math.min(questionNumber, interview.maxQuestions), total: interview.maxQuestions })}
            </p>

            <InterviewerPresence phase={phase} statusKey={statusKey} label={d.room.interviewer} status={d.room.states[statusKey]} recordingTime={phase === "RECORDING" ? clockTime(recorder.elapsed) : null} />

            {phase === "READY" ? (
              <div className="mt-10 animate-fade-up">
                <h1 className="font-display text-[1.9rem] leading-tight font-medium sm:text-[2.3rem]">{isResuming ? d.room.resumeTitle : d.room.beginTitle}</h1>
                <p className="mt-3 max-w-lg text-[15px] leading-relaxed text-muted">{isResuming ? fmt(d.room.resumeBody, { n: questionNumber }) : d.room.beginBody}</p>
                <ul className="mt-6 space-y-2.5 border-s border-border ps-4">
                  {d.room.checklist.map((c) => (
                    <li key={c} className="text-sm text-muted">
                      {c}
                    </li>
                  ))}
                </ul>
                <Button size="lg" className="mt-8 w-full sm:w-auto" onClick={begin}>
                  {isResuming ? d.room.resume : d.room.begin}
                </Button>
              </div>
            ) : (
              currentQuestion && (
                <div className="mt-8 animate-fade-up" key={currentQuestion.id}>
                  {currentQuestion.kind === "FOLLOW_UP" && <p className="mb-2 text-[13px] font-medium text-primary">{d.room.followUp}</p>}
                  <p className="font-display text-[1.65rem] leading-[1.25] font-[450] text-pretty sm:text-[2.15rem] sm:leading-[1.2]" dir="auto" lang={interview.language}>
                    {currentQuestion.text}
                  </p>
                  <div className="mt-4 flex flex-wrap items-center gap-3">
                    <Button variant="ghost" size="sm" className="-ms-3" onClick={repeat} disabled={phase !== "WAITING_FOR_USER" && phase !== "REVIEW"}>
                      <Volume2 className="size-4 rtl:-scale-x-100" />
                      {d.room.repeat}
                    </Button>
                    {!speech.supported && <span className="text-xs text-subtle">{d.room.noTts}</span>}
                  </div>
                </div>
              )
            )}

            {phase !== "READY" && (
              <div className="mt-10 lg:mt-14">
                {error && (
                  <div role="alert" className="mb-3 flex items-start gap-3 rounded-lg border border-danger/25 bg-danger-soft px-4 py-3 text-sm">
                    <AlertCircle className="mt-0.5 size-4 shrink-0 text-danger" />
                    <p className="flex-1 text-fg">{error.message}</p>
                    {error.retry && (
                      <button className="shrink-0 font-medium text-danger hover:underline" onClick={error.retry}>
                        {d.common.retry}
                      </button>
                    )}
                  </div>
                )}
                <div className={cn("rounded-xl border bg-surface p-4 transition-colors sm:p-5", phase === "RECORDING" ? "border-danger/35" : "border-border")}>
                  <AnswerDock
                    phase={phase}
                    inputMode={inputMode}
                    draft={draft}
                    setDraft={setDraft}
                    elapsed={recorder.elapsed}
                    maxSeconds={maxSeconds}
                    levels={recorder.levels}
                    hasError={!!error}
                    onStart={startAnswer}
                    onStop={stopAnswer}
                    onSubmit={submit}
                    onToggleMode={() => {
                      setError(null);
                      setInputMode((m) => (m === "voice" ? "text" : "voice"));
                    }}
                    canUseMic={recordingSupported}
                  />
                </div>
                <p className={cn("mt-3 flex items-center gap-2 text-xs", phase === "RECORDING" ? "text-danger" : "text-subtle")}>
                  {phase === "RECORDING" ? <span className="size-1.5 rounded-full bg-danger" /> : <Lock className="size-3.5" />}
                  {phase === "RECORDING" ? d.room.recordingNotice : d.room.privacy}
                </p>
              </div>
            )}
          </div>
        </main>

        <TranscriptPanel questions={interview.questions} phase={phase} language={interview.language} pending={phase === "ANALYZING" ? draft : null} />
      </div>
    </div>
  );
}

/** The interviewer's presence + a status line whose look differs per state. */
function InterviewerPresence({ phase, statusKey, label, status, recordingTime }: { phase: Phase; statusKey: string; label: string; status: string; recordingTime: string | null }) {
  const speaking = phase === "AI_SPEAKING";
  const busy = phase === "TRANSCRIBING" || phase === "ANALYZING" || phase === "COMPLETED";
  const tone =
    statusKey === "ERROR" ? "text-danger" : phase === "RECORDING" ? "text-danger" : speaking ? "text-primary" : phase === "WAITING_FOR_USER" || phase === "REVIEW" ? "text-success" : "text-muted";

  return (
    <div className="mt-5 flex items-center gap-3.5">
      <div className="relative shrink-0">
        {speaking && <span className="absolute -inset-1 rounded-full border-2 border-primary/50 animate-pulse-ring" />}
        <div className={cn("grid size-11 place-items-center rounded-full bg-ink text-ink-fg transition-transform duration-300", speaking && "scale-105")}>
          <Waveform bars={3} active={speaking} className="h-4 gap-[3px] [&>span]:w-[2.5px]" />
        </div>
      </div>
      <div className="min-w-0">
        <p className="text-sm font-medium">{label}</p>
        <p className={cn("mt-0.5 flex items-center gap-2 text-[13px] font-medium", tone)} aria-live="polite">
          {busy ? (
            <Spinner className="size-3.5" />
          ) : speaking ? (
            <Waveform bars={4} active className="h-3 gap-[2px] [&>span]:w-[2px]" />
          ) : (
            <span className={cn("size-2 rounded-full bg-current", phase === "RECORDING" && "animate-pulse")} />
          )}
          {status}
          {recordingTime && <span className="font-normal tabular-nums opacity-80">{recordingTime}</span>}
        </p>
      </div>
    </div>
  );
}

function AnswerDock(props: {
  phase: Phase;
  inputMode: "voice" | "text";
  draft: string;
  setDraft: (v: string) => void;
  elapsed: number;
  maxSeconds: number;
  levels: number[];
  hasError: boolean;
  canUseMic: boolean;
  onStart: () => void;
  onStop: () => void;
  onSubmit: () => void;
  onToggleMode: () => void;
}) {
  const { d, fmt } = useI18n();
  const { phase, inputMode } = props;

  if (phase === "RECORDING") {
    const left = Math.max(0, props.maxSeconds - props.elapsed);
    return (
      <div className="flex items-center gap-4">
        <button onClick={props.onStop} className="relative grid size-14 shrink-0 place-items-center rounded-full bg-danger text-white outline-none transition-transform focus-visible:ring-4 focus-visible:ring-danger/30 active:scale-95" aria-label={d.room.stopAnswer}>
          <span className="absolute inset-0 rounded-full bg-danger/35 animate-pulse-ring" />
          <Square className="relative size-[18px] fill-current" />
        </button>
        <div className="min-w-0 flex-1">
          <Waveform levels={props.levels} bars={props.levels.length} className="h-9 w-full justify-between overflow-hidden text-danger/75" />
        </div>
        <div className="shrink-0 text-end">
          <p className="font-medium tabular-nums" dir="ltr">
            {clockTime(props.elapsed)}
          </p>
          <p className={cn("text-xs tabular-nums", left <= 15 ? "text-danger" : "text-subtle")}>{fmt(d.room.timeLeft, { t: clockTime(left) })}</p>
        </div>
      </div>
    );
  }

  if (phase === "TRANSCRIBING" || phase === "ANALYZING" || phase === "COMPLETED" || phase === "AI_SPEAKING") {
    const label = phase === "AI_SPEAKING" ? d.room.states.AI_SPEAKING : phase === "TRANSCRIBING" ? d.room.states.TRANSCRIBING : phase === "ANALYZING" ? d.room.states.ANALYZING : d.room.states.COMPLETED;
    return (
      <div className="flex items-center gap-4">
        <span className="grid size-14 shrink-0 place-items-center rounded-full border border-border text-subtle">
          {phase === "AI_SPEAKING" ? <Mic className="size-5" /> : <Spinner className="text-primary" />}
        </span>
        <div>
          <p className="font-medium text-muted">{label}</p>
          {phase !== "AI_SPEAKING" && <p className="text-sm text-subtle">{d.room.analyzingHint}</p>}
        </div>
      </div>
    );
  }

  const showEditor = phase === "REVIEW" || inputMode === "text";
  if (showEditor) {
    return (
      <div>
        <div className="mb-2 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
          <label htmlFor="answer" className="text-sm font-medium">
            {d.room.transcriptLabel}
          </label>
          {phase === "REVIEW" && <span className="text-xs text-subtle">{d.room.transcriptHint}</span>}
        </div>
        <Textarea
          id="answer"
          dir="auto"
          value={props.draft}
          maxLength={4000}
          onChange={(e) => props.setDraft(e.target.value)}
          placeholder={d.room.typePlaceholder}
          className="min-h-32 text-[15px]"
          autoFocus={inputMode === "text"}
        />
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
          {props.canUseMic ? (
            <Button variant="ghost" size="sm" className="-ms-3" onClick={phase === "REVIEW" && inputMode === "voice" ? props.onStart : props.onToggleMode}>
              <Mic className="size-4" />
              {phase === "REVIEW" && inputMode === "voice" ? d.room.rerecord : d.room.useMic}
            </Button>
          ) : (
            <span />
          )}
          <Button onClick={props.onSubmit} disabled={!props.draft.trim()}>
            {d.room.submit}
          </Button>
        </div>
      </div>
    );
  }

  // WAITING_FOR_USER, voice mode
  return (
    <div className="flex flex-col items-center gap-4 sm:flex-row">
      <button
        onClick={props.onStart}
        className="grid size-14 shrink-0 place-items-center rounded-full bg-primary text-primary-fg outline-none transition hover:bg-primary-hover focus-visible:ring-4 focus-visible:ring-primary/30 active:scale-95"
        aria-label={d.room.startAnswer}
      >
        <Mic className="size-[22px]" />
      </button>
      <div className="text-center sm:text-start">
        <p className="font-medium">{d.room.startAnswer}</p>
        <p className="text-sm text-subtle">{d.room.checklist[1]}</p>
      </div>
      <Button variant="ghost" size="sm" className="sm:ms-auto" onClick={props.onToggleMode}>
        <Keyboard className="size-4" />
        {d.room.typeInstead}
      </Button>
    </div>
  );
}
