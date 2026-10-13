import { cn } from "@/lib/utils";

/**
 * Bar waveform. With `levels` (0..1 per bar) it renders live mic input;
 * otherwise `active` plays a gentle idle animation.
 */
export function Waveform({ bars = 24, levels, active, className }: { bars?: number; levels?: number[]; active?: boolean; className?: string }) {
  return (
    <span className={cn("flex h-8 items-center gap-[3px]", className)} aria-hidden>
      {Array.from({ length: bars }, (_, i) => {
        const level = levels ? Math.max(0.12, levels[i] ?? 0) : 0.15 + 0.85 * Math.abs(Math.sin(i * 1.7));
        return (
          <span
            key={i}
            className={cn("h-full w-[3px] rounded-full bg-current transition-transform duration-75", !levels && active && "animate-speak-bar")}
            style={{
              // Idle: a calm static glyph rather than flat dots.
              transform: `scaleY(${levels || active ? level : 0.25 + 0.5 * Math.abs(Math.sin(i * 1.3 + 0.6))})`,
              animationDelay: !levels && active ? `${(i % 7) * 0.11}s` : undefined,
            }}
          />
        );
      })}
    </span>
  );
}
