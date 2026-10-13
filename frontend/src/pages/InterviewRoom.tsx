import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import { AlertCircle, Check, Keyboard, Lock, Mic, Square, Volume2 } from "lucide-react";
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
  const statusKey = error && phase !== "AI_SPEAKING" && phase !== "RECORDING" ? "ERROR" : phase === "ANALYZING" && slowAnalysis ? "PREPARING" : phase;
  const isResuming = answeredCount > 0;

  return (
    <div className="flex min-h-dvh flex-col bg-bg lg:h-dvh">
      {/* Top bar */}
      <header className="flex h-16 shrink-0 items-center gap-3 border-b border-border px-4 sm:px-6">
        <Link to="/dashboard" aria-label={d.nav.dashboard}>
          <LogoMark />
        </Link>
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">{roleName}</p>
          <p className="truncate text-xs text-muted">
            {d.levels[interview.difficulty]} · {d.langs[interview.language]}
          </p>
        </div>
        <div className="ms-auto flex items-center gap-1.5 sm:gap-2">
          {interview.isMock && (
            <Tooltip content={d.common.demoModeHint}>
              <Badge tone="warning" className="hidden sm:inline-flex">
                {d.common.demoMode}
              </Badge>
            </Tooltip>
          )}
          <span className="me-1 text-sm text-muted tabular-nums" dir="ltr">
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
                  <Button className="bg-danger hover:bg-danger/90" onClick={endInterview}>
                    {d.room.endConfirm}
                  </Button>
                </DialogClose>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </header>

      <div className="grid flex-1 lg:min-h-0 lg:grid-cols-[minmax(0,1fr)_380px] xl:grid-cols-[minmax(0,1fr)_420px]">
        <main className="flex flex-col lg:min-h-0 lg:overflow-y-auto">
          <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col px-4 py-6 sm:px-6 lg:py-8">
            {/* Progress */}
            <div className="flex items-center justify-between text-[13px] text-muted">
              <span>{fmt(d.room.questionOf, { n: Math.min(questionNumber, interview.maxQuestions), total: interview.maxQuestions })}</span>
              <span className="tabular-nums">{Math.round((answeredCount / interview.maxQuestions) * 100)}%</span>
            </div>
            <div className="mt-2 flex gap-1" aria-hidden>
              {Array.from({ length: interview.maxQuestions }, (_, i) => (
                <span key={i} className={cn("h-1 flex-1 rounded-full transition-colors", i < answeredCount ? "bg-primary" : i === answeredCount && phase !== "READY" ? "bg-primary/40" : "bg-surface-2")} />
              ))}
            </div>

            {/* Interviewer */}
            <InterviewerTile phase={phase} statusKey={statusKey} label={d.room.interviewer} status={d.room.states[statusKey]} />

            {/* Question or start card */}
            {phase === "READY" ? (
              <div className="mt-8 animate-fade-up">
                <h1 className="text-xl font-semibold tracking-tight">{isResuming ? d.room.resumeTitle : d.room.beginTitle}</h1>
                <p className="mt-2 text-muted">{isResuming ? fmt(d.room.resumeBody, { n: questionNumber }) : d.room.beginBody}</p>
                <ul className="mt-5 space-y-2">
                  {d.room.checklist.map((c) => (
                    <li key={c} className="flex items-center gap-2.5 text-sm text-muted">
                      <Check className="size-4 text-success" />
                      {c}
                    </li>
                  ))}
                </ul>
                <Button size="lg" className="mt-7 w-full sm:w-auto" onClick={begin}>
                  {isResuming ? d.room.resume : d.room.begin}
                </Button>
              </div>
            ) : (
              currentQuestion && (
                <div className="mt-8 animate-fade-up" key={currentQuestion.id}>
                  <div className="flex items-center gap-2">
                    <span className="text-[13px] font-medium text-primary">{fmt(d.room.question, { n: currentQuestion.order })}</span>
                    {currentQuestion.kind === "FOLLOW_UP" && <Badge tone="primary">{d.room.followUp}</Badge>}
                  </div>
                  <p className="mt-2 text-[1.35rem] leading-snug font-medium tracking-tight text-balance sm:text-[1.6rem]" dir="auto" lang={interview.language}>
                    {currentQuestion.text}
                  </p>
                  <div className="mt-3 flex flex-wrap items-center gap-3">
                    <Button variant="ghost" size="sm" className="-ms-3" onClick={repeat} disabled={phase !== "WAITING_FOR_USER" && phase !== "REVIEW"}>
                      <Volume2 className="size-4 rtl:-scale-x-100" />
                      {d.room.repeat}
                    </Button>
                    {!speech.supported && <span className="text-xs text-subtle">{d.room.noTts}</span>}
                  </div>
                </div>
              )
            )}

            {/* Answer dock */}
            {phase !== "READY" && (
              <div className="mt-8 lg:mt-auto lg:pt-8">
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
                <div className="rounded-xl border border-border bg-surface p-4 sm:p-5">
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

function InterviewerTile({ phase, statusKey, label, status }: { phase: Phase; statusKey: string; label: string; status: string }) {
  const speaking = phase === "AI_SPEAKING";
  const dot =
    statusKey === "ERROR" ? "bg-[#f2706a]" : phase === "RECORDING" ? "bg-[#f2706a] animate-pulse" : speaking ? "bg-[#8d98ff]" : phase === "WAITING_FOR_USER" || phase === "REVIEW" ? "bg-[#3cc48d]" : "bg-white/40";
  const busy = phase === "TRANSCRIBING" || phase === "ANALYZING" || phase === "COMPLETED";
  return (
    <div className="mt-6 flex flex-col items-center rounded-xl bg-navy px-6 py-8 text-white sm:py-10 dark:border dark:border-border">
      <div className="relative">
        {speaking && <span className="absolute inset-0 rounded-full bg-[#5866f2]/45 animate-pulse-ring" />}
        <div className={cn("relative grid size-20 place-items-center rounded-full bg-[#1a2350] ring-1 ring-white/10 transition-colors", speaking && "bg-[#2a3480]")}>
          <Waveform bars={5} active={speaking} className="h-7 gap-1 text-white [&>span]:w-1" />
        </div>
      </div>
      <p className="mt-4 text-sm font-medium">{label}</p>
      <p className="mt-2 inline-flex items-center gap-2 rounded-full bg-white/[0.07] px-3 py-1 text-xs text-white/80" aria-live="polite">
        {busy ? <Spinner className="size-3.5 text-white/80" /> : <span className={cn("size-1.5 rounded-full", dot)} />}
        {status}
      </p>
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
        <button onClick={props.onStop} className="relative grid size-14 shrink-0 place-items-center rounded-full bg-danger text-white transition-transform active:scale-95" aria-label={d.room.stopAnswer}>
          <span className="absolute inset-0 rounded-full bg-danger/40 animate-pulse-ring" />
          <Square className="relative size-5 fill-current" />
        </button>
        <div className="min-w-0 flex-1">
          <Waveform levels={props.levels} bars={props.levels.length} className="h-9 w-full justify-between overflow-hidden text-danger/80" />
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
        <span className={cn("grid size-14 shrink-0 place-items-center rounded-full", phase === "AI_SPEAKING" ? "bg-surface-2 text-subtle" : "bg-primary-soft text-primary")}>
          {phase === "AI_SPEAKING" ? <Mic className="size-5" /> : <Spinner />}
        </span>
        <div>
          <p className="font-medium">{label}</p>
          {phase !== "AI_SPEAKING" && <p className="text-sm text-muted">{d.room.analyzingHint}</p>}
        </div>
      </div>
    );
  }

  const showEditor = phase === "REVIEW" || inputMode === "text";
  if (showEditor) {
    return (
      <div>
        <div className="mb-2 flex items-baseline justify-between gap-3">
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
          className="min-h-32"
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
    <div className="flex flex-col items-center gap-4 py-2 sm:flex-row sm:py-0">
      <button
        onClick={props.onStart}
        className="grid size-16 shrink-0 place-items-center rounded-full bg-primary text-primary-fg shadow-sm transition hover:bg-primary-hover active:scale-95 focus-visible:ring-4 focus-visible:ring-primary/30 outline-none"
        aria-label={d.room.startAnswer}
      >
        <Mic className="size-6" />
      </button>
      <div className="text-center sm:text-start">
        <p className="font-medium">{d.room.startAnswer}</p>
        <p className="text-sm text-muted">{d.room.checklist[1]}</p>
      </div>
      <Button variant="ghost" size="sm" className="sm:ms-auto" onClick={props.onToggleMode}>
        <Keyboard className="size-4" />
        {d.room.typeInstead}
      </Button>
    </div>
  );
}
