import { Volume2 } from "lucide-react";
import { Spinner } from "@/components/ui/spinner";
import { Waveform } from "./Waveform";
import { useI18n } from "@/i18n";
import { cn } from "@/lib/utils";

export function InterviewerAvatar({ speaking, className }: { speaking?: boolean; className?: string }) {
  return (
    <div className={cn("relative shrink-0", className)}>
      {speaking && <span className="absolute -inset-1 rounded-full border-2 border-primary/45 animate-pulse-ring" />}
      <div className="grid size-8 place-items-center rounded-full bg-ink text-ink-fg">
        <Waveform bars={3} active={speaking} className="h-3 gap-[2px] [&>span]:w-[2px]" />
      </div>
    </div>
  );
}

/** A question from the interviewer. The current one is set larger; earlier ones recede. */
export function AiMessage(props: {
  text: string;
  lang: "en" | "ar";
  followUp?: boolean;
  current?: boolean;
  speaking?: boolean;
  canReplay?: boolean;
  onReplay?: () => void;
}) {
  const { d } = useI18n();
  return (
    <div className="flex animate-fade-up gap-3 sm:gap-4">
      <InterviewerAvatar speaking={props.speaking} className="mt-0.5" />
      <div className="min-w-0 flex-1">
        <p className="flex flex-wrap items-center gap-x-2 text-[13px]">
          <span className="font-medium">{d.room.interviewer}</span>
          {props.followUp && <span className="text-subtle">· {d.room.followUp}</span>}
          {props.speaking && (
            <span className="flex items-center gap-1.5 font-medium text-primary">
              <Waveform bars={4} active className="h-3 gap-[2px] [&>span]:w-[2px]" />
              {d.room.speaking}
            </span>
          )}
        </p>
        <p
          className={cn(
            "mt-1.5 font-display text-pretty",
            props.current ? "text-[1.4rem] leading-[1.3] font-[450] sm:text-[1.6rem]" : "text-[1.15rem] leading-snug text-fg/75",
          )}
          dir="auto"
          lang={props.lang}
        >
          {props.text}
        </p>
        {props.current && props.onReplay && (
          <button
            type="button"
            onClick={props.onReplay}
            disabled={!props.canReplay}
            className="-ms-1.5 mt-2 inline-flex items-center gap-1.5 rounded-md px-1.5 py-1 text-xs text-subtle transition-colors hover:text-fg disabled:pointer-events-none disabled:opacity-40"
          >
            <Volume2 className="size-3.5 rtl:-scale-x-100" />
            {d.room.replay}
          </button>
        )}
      </div>
    </div>
  );
}

type StudentState = "final" | "sending" | "failed" | "recording" | "transcribing";

/** The student's answer as a message in the conversation. */
export function StudentMessage(props: { state: StudentState; text?: string; recordingTime?: string }) {
  const { d } = useI18n();
  return (
    <div className="flex animate-fade-up justify-end">
      <div
        className={cn(
          "w-fit max-w-[88%] rounded-lg border bg-surface px-4 py-3 transition-colors sm:max-w-[80%]",
          props.state === "recording" || props.state === "failed" ? "border-danger/35" : "border-border",
        )}
      >
        <p className="mb-1 text-xs text-subtle">{d.room.you}</p>
        {props.state === "recording" ? (
          <p className="flex items-center gap-2 text-[15px] text-danger">
            <span className="size-2 animate-pulse rounded-full bg-current" />
            {d.room.states.RECORDING}
            <span className="tabular-nums text-danger/80" dir="ltr">
              {props.recordingTime}
            </span>
          </p>
        ) : props.state === "transcribing" ? (
          <p className="flex items-center gap-2 text-[15px] text-muted">
            <Spinner className="size-3.5" />
            {d.room.transcribingMsg}
          </p>
        ) : (
          <p className="text-[15px] leading-relaxed whitespace-pre-wrap" dir="auto">
            {props.text}
          </p>
        )}
      </div>
    </div>
  );
}

export function ThinkingMessage() {
  const { d } = useI18n();
  return (
    <div className="flex animate-fade-up gap-3 sm:gap-4">
      <InterviewerAvatar className="mt-0.5" />
      <div>
        <p className="text-[13px] font-medium">{d.room.interviewer}</p>
        <p className="mt-2 flex items-center gap-2.5 text-sm text-muted">
          <span className="flex gap-1" aria-hidden>
            {[0, 1, 2].map((k) => (
              <span key={k} className="size-1.5 animate-pulse rounded-full bg-subtle" style={{ animationDelay: `${k * 0.18}s` }} />
            ))}
          </span>
          {d.room.thinking}
        </p>
      </div>
    </div>
  );
}
