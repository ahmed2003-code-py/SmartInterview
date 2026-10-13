import { Square } from "lucide-react";
import { useI18n } from "@/i18n";
import { LogoMark } from "@/components/layout/Logo";
import { Waveform } from "@/features/interview/Waveform";

/** Static, non-interactive mock of the interview room for the landing hero. */
export function InterviewPreview() {
  const { d, fmt } = useI18n();
  return (
    <div className="relative overflow-hidden rounded-xl border border-border bg-surface shadow-md" aria-hidden>
      <div className="flex items-center justify-between gap-4 border-b border-border px-4 py-3">
        <span className="truncate text-[13px] font-medium">{d.landing.previewRole}</span>
        <div className="flex shrink-0 items-center gap-3 text-[13px] text-muted">
          <span>{fmt(d.room.questionOf, { n: 3, total: 6 })}</span>
          <span className="tabular-nums" dir="ltr">
            04:12
          </span>
        </div>
      </div>
      <div className="flex gap-1 px-4 pt-3">
        {Array.from({ length: 6 }, (_, i) => (
          <span key={i} className={`h-1 flex-1 rounded-full ${i < 2 ? "bg-primary" : i === 2 ? "bg-primary/45" : "bg-surface-2"}`} />
        ))}
      </div>

      <div className="grid gap-3 p-3 sm:grid-cols-[1.35fr_1fr] sm:p-4">
        {/* Stage */}
        <div className="flex flex-col items-center rounded-lg bg-navy px-5 pt-8 pb-5 text-center text-white">
          <div className="flex flex-1 flex-col items-center justify-center">
          <div className="relative">
            <span className="absolute inset-0 rounded-full bg-[#5866f2]/40 animate-pulse-ring" />
            <div className="relative grid size-16 place-items-center rounded-full bg-[#1a2350] ring-1 ring-white/10">
              <LogoMark className="size-8" />
            </div>
          </div>
          <p className="mt-3 text-xs text-white/60">{d.room.interviewer}</p>
          <p className="mt-4 text-[15px] leading-snug font-medium text-balance">{d.landing.previewFollowUp}</p>
          </div>
          <div className="mt-6 flex w-full items-center gap-3 rounded-lg bg-white/[0.06] p-2 ps-3">
            <span className="size-2 shrink-0 rounded-full bg-[#f2706a]" />
            <span className="text-xs whitespace-nowrap text-white/75">{d.landing.previewStatus}</span>
            <Waveform className="mx-auto h-5 min-w-0 overflow-hidden text-white/70" bars={18} active />
            <span className="grid size-8 shrink-0 place-items-center rounded-md bg-[#f2706a] text-white">
              <Square className="size-3 fill-current" />
            </span>
          </div>
        </div>

        {/* Transcript */}
        <div className="hidden flex-col gap-3 rounded-lg border border-border p-3 text-[13px] sm:flex">
          <p className="text-xs font-medium text-subtle">{d.landing.previewTranscript}</p>
          <div>
            <p className="mb-0.5 text-xs font-medium text-primary">{d.room.interviewer}</p>
            <p className="leading-snug text-muted">{d.landing.previewQuestion}</p>
          </div>
          <div className="rounded-md bg-surface-2 p-2.5">
            <p className="mb-0.5 text-xs font-medium">{d.room.you}</p>
            <p className="leading-snug text-muted">{d.landing.previewAnswer}</p>
          </div>
          <div>
            <p className="mb-0.5 text-xs font-medium text-primary">{d.room.interviewer}</p>
            <p className="leading-snug text-muted">{d.landing.previewFollowUp}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
