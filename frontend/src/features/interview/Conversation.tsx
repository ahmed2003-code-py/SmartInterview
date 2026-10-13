import { Volume2 } from "lucide-react";
import { Waveform } from "./Waveform";
import { useI18n } from "@/i18n";
import { m } from "@/lib/motion";
import { cn, textDir } from "@/lib/utils";
import { ExpandableText } from "@/components/ui/expandable-text";

const ORB = { sm: "size-7", md: "size-9", lg: "size-14" } as const;

/**
 * The interviewer's presence: an orb on the AI-signal gradient.
 * Idle → still. Speaking → voice bars + soft rings. Thinking → three bouncing dots.
 */
export function AiOrb({ speaking, thinking, size = "md", className }: { speaking?: boolean; thinking?: boolean; size?: keyof typeof ORB; className?: string }) {
  return (
    <div className={cn("relative shrink-0", ORB[size], className)}>
      {speaking && (
        <>
          <span className="absolute -inset-1 animate-pulse-ring rounded-full bg-ai-1/25" />
          <span className="absolute -inset-1 animate-pulse-ring rounded-full bg-ai-2/20 [animation-delay:0.6s]" />
        </>
      )}
      <div className={cn("ai-gradient relative grid size-full place-items-center rounded-full text-white shadow-sm", (speaking || thinking) && "animate-orb")}>
        {thinking ? (
          <span className="flex gap-[3px]">
            {[0, 1, 2].map((k) => (
              <span key={k} className="size-[3px] animate-dot rounded-full bg-white" style={{ animationDelay: `${k * 0.15}s` }} />
            ))}
          </span>
        ) : (
          <Waveform bars={size === "lg" ? 5 : 3} active={speaking} className={cn("gap-[2px] [&>span]:w-[2px]", size === "lg" ? "h-5" : "h-3")} />
        )}
      </div>
    </div>
  );
}

/** Kept for places that only need the avatar. */
export const InterviewerAvatar = AiOrb;

/** A question from the interviewer. The current one is emphasized with an accent edge; earlier ones recede. */
export function AiMessage(props: {
  text: string;
  lang: "en" | "ar";
  followUp?: boolean;
  current?: boolean;
  speaking?: boolean;
  canReplay?: boolean;
  onReplay?: () => void;
  number?: number;
}) {
  const { d, fmt } = useI18n();
  return (
    <m.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }} className="flex gap-3 sm:gap-4">
      <AiOrb speaking={props.speaking} size={props.current ? "md" : "sm"} className={props.current ? "" : "mt-0.5 opacity-70"} />
      <div className={cn("min-w-0 flex-1", props.current && "border-s-2 border-primary ps-3.5 sm:ps-4")}>
        <p className="flex flex-wrap items-center gap-x-2 text-[12.5px]">
          <span className={cn("font-medium", props.current ? "text-fg" : "text-subtle")}>{props.number ? fmt(d.room.question, { n: props.number }) : d.room.interviewer}</span>
          {props.followUp && <span className="rounded-full bg-primary-soft px-2 py-px text-[11px] font-medium text-primary-soft-fg">{d.room.followUp}</span>}
          {props.speaking && (
            <span className="flex items-center gap-1.5 font-medium text-primary">
              <Waveform bars={4} active className="h-3 gap-[2px] [&>span]:w-[2px]" />
              {d.room.speaking}
            </span>
          )}
        </p>
        <p
          className={cn(
            "mt-1.5 text-pretty transition-[color,font-size] duration-300",
            props.current ? "text-[1.3rem] leading-[1.35] font-semibold tracking-[-0.015em] sm:text-[1.5rem]" : "text-[15px] leading-relaxed text-fg/60",
          )}
          dir={textDir(props.text)}
          lang={props.lang}
        >
          {props.text}
        </p>
        {props.current && props.onReplay && (
          <button
            type="button"
            onClick={props.onReplay}
            disabled={!props.canReplay}
            className="-ms-1.5 mt-2 inline-flex items-center gap-1.5 rounded-md px-1.5 py-1 text-xs text-subtle transition-colors hover:bg-surface-2 hover:text-fg disabled:pointer-events-none disabled:opacity-40"
          >
            <Volume2 className="size-3.5 rtl:-scale-x-100" />
            {d.room.replay}
          </button>
        )}
      </div>
    </m.div>
  );
}

type StudentState = "final" | "sending" | "failed" | "recording" | "transcribing";

/**
 * The student's answer as a message. While recording it shows the live mic waveform and (where the
 * browser supports it) provisional captions; these are display-only and are replaced by the final
 * transcript, which is exactly what gets evaluated. Long answers are clamped with "Show more".
 */
export function StudentMessage(props: { state: StudentState; text?: string; recordingTime?: string; caption?: string; levels?: number[] }) {
  const { d } = useI18n();
  const caption = props.caption?.trim();
  const live = props.state === "recording" || props.state === "transcribing";
  return (
    <m.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }} className="flex justify-end">
      <div
        className={cn(
          "w-fit max-w-[90%] min-w-[min(18rem,90%)] rounded-2xl rounded-ee-md px-4 py-3 transition-colors duration-300 sm:max-w-[80%]",
          props.state === "recording" ? "bg-rec-soft ring-1 ring-rec/25" : props.state === "failed" ? "bg-danger-soft ring-1 ring-danger/25" : "bg-surface-2",
          props.state === "sending" && "opacity-75",
        )}
      >
        <div className="mb-1 flex items-center justify-between gap-4 text-xs">
          <span className="text-subtle">{d.room.you}</span>
          {props.state === "recording" && (
            <span className="flex items-center gap-2 font-medium text-rec">
              <span className="size-1.5 animate-pulse rounded-full bg-current" />
              <span className="tabular-nums" dir="ltr">
                {props.recordingTime}
              </span>
            </span>
          )}
          {props.state === "transcribing" && <span className="animate-shimmer rounded px-1 text-muted">{d.room.transcribingMsg}</span>}
        </div>

        {live ? (
          <>
            {/* The live waveform lives in the dock; here, captions (or a quiet "Listening…") only. */}
            {caption ? (
              <p className="text-[15px] leading-relaxed text-muted" dir={textDir(caption)}>
                {caption}
              </p>
            ) : (
              <div className="space-y-2 py-1" aria-label={props.state === "recording" ? d.room.listening : d.room.transcribingMsg}>
                <div className={cn("h-2.5 w-11/12 rounded-full bg-current opacity-10", props.state === "transcribing" ? "animate-shimmer" : "animate-pulse")} />
                <div className={cn("h-2.5 w-2/3 rounded-full bg-current opacity-10", props.state === "transcribing" ? "animate-shimmer" : "animate-pulse")} />
              </div>
            )}
          </>
        ) : (
          <ExpandableText text={props.text ?? ""} lines={5} className="text-[15px] leading-relaxed" />
        )}
      </div>
    </m.div>
  );
}
