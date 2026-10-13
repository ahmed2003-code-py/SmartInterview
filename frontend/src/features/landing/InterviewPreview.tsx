import { Square } from "lucide-react";
import { useI18n } from "@/i18n";
import { LogoMark } from "@/components/layout/Logo";
import { Waveform } from "@/features/interview/Waveform";

/** Static, non-interactive replica of the interview room used as the landing hero image. */
export function InterviewPreview() {
  const { d, fmt } = useI18n();
  return (
    <div className="overflow-hidden rounded-xl border border-border-strong/70 bg-bg shadow-md select-none" aria-hidden>
      {/* header */}
      <div className="flex h-11 items-center gap-3 border-b border-border px-4">
        <LogoMark className="size-5" />
        <span className="h-4 w-px bg-border" />
        <span className="truncate text-[13px] font-medium">{d.landing.previewRole}</span>
        <span className="ms-auto text-xs text-muted tabular-nums" dir="ltr">
          04:12
        </span>
        <span className="hidden text-xs font-medium text-danger sm:inline">{d.room.endInterview}</span>
      </div>
      <div className="flex h-[3px] gap-px bg-border">
        {Array.from({ length: 6 }, (_, i) => (
          <span key={i} className={`flex-1 ${i < 2 ? "bg-primary" : i === 2 ? "bg-primary/35" : "bg-surface-2"}`} />
        ))}
      </div>

      <div className="grid sm:grid-cols-[minmax(0,1fr)_minmax(0,0.62fr)]">
        {/* stage */}
        <div className="px-5 pt-6 pb-5 sm:px-8 sm:pt-9">
          <p className="text-xs text-subtle">{fmt(d.room.questionOf, { n: 3, total: 6 })}</p>
          <div className="mt-4 flex items-center gap-3">
            <div className="grid size-9 place-items-center rounded-full bg-ink text-ink-fg">
              <Waveform bars={3} className="h-3.5 gap-[3px] [&>span]:w-[2px]" />
            </div>
            <div>
              <p className="text-[13px] font-medium">{d.room.interviewer}</p>
              <p className="flex items-center gap-1.5 text-xs font-medium text-danger">
                <span className="size-1.5 rounded-full bg-current" />
                {d.room.states.RECORDING}
                <span className="font-normal tabular-nums opacity-80">0:24</span>
              </p>
            </div>
          </div>
          <p className="mt-6 text-xs font-medium text-primary">{d.room.followUp}</p>
          <p className="mt-1.5 font-display text-[1.3rem] leading-snug font-[450] text-pretty sm:text-[1.55rem]">{d.landing.previewFollowUp}</p>

          <div className="mt-8 flex items-center gap-3 rounded-lg border border-danger/35 bg-surface p-3">
            <span className="relative grid size-10 shrink-0 place-items-center rounded-full bg-danger text-white">
              <span className="absolute inset-0 rounded-full bg-danger/35 animate-pulse-ring" />
              <Square className="relative size-3.5 fill-current" />
            </span>
            <Waveform bars={34} active className="h-7 min-w-0 flex-1 justify-between overflow-hidden text-danger/70" />
            <span className="shrink-0 text-[13px] font-medium tabular-nums" dir="ltr">
              0:24
            </span>
          </div>
        </div>

        {/* transcript */}
        <div className="hidden border-s border-border bg-surface sm:block">
          <div className="flex h-10 items-center border-b border-border px-4 text-xs font-medium">{d.landing.previewTranscript}</div>
          <div className="space-y-4 p-4 text-[13px] leading-relaxed">
            <div>
              <p className="mb-1 text-[11px] text-subtle">2. {d.room.interviewer}</p>
              <p>{d.landing.previewQuestion}</p>
              <div className="mt-2 border-s-2 border-border-strong ps-2.5">
                <p className="mb-0.5 text-[11px] text-subtle">{d.room.you}</p>
                <p className="text-muted">{d.landing.previewAnswer}</p>
              </div>
            </div>
            <div>
              <p className="mb-1 text-[11px] text-subtle">
                3. {d.room.interviewer} <span className="text-primary">· {d.room.followUp}</span>
              </p>
              <p>{d.landing.previewFollowUp}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
