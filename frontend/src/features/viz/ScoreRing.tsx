import { useId } from "react";
import { m, useCountUp, EASE } from "@/lib/motion";
import { cn } from "@/lib/utils";

/**
 * The one score visualization: a thin ring on the AI-signal gradient that draws to the score while
 * the number counts up. Used by the report hero (and the landing sample).
 */
export function ScoreRing({ score, size = 168, stroke = 10, label, className }: { score: number; size?: number; stroke?: number; label?: string; className?: string }) {
  const id = useId();
  const r = (size - stroke) / 2;
  const { ref, value } = useCountUp(score, { duration: 900 });
  return (
    <div className={cn("relative grid shrink-0 place-items-center", className)} style={{ width: size, height: size }} role="img" aria-label={`${label ?? ""} ${score} / 100`}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90" aria-hidden>
        <defs>
          <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="var(--ai-1)" />
            <stop offset="1" stopColor="var(--ai-2)" />
          </linearGradient>
        </defs>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--surface-2)" strokeWidth={stroke} />
        <m.circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={`url(#${id})`}
          strokeWidth={stroke}
          strokeLinecap="round"
          initial={{ pathLength: 0 }}
          whileInView={{ pathLength: Math.max(0.001, score / 100) }}
          viewport={{ once: true }}
          transition={{ duration: 0.9, ease: EASE }}
        />
      </svg>
      <div className="absolute inset-0 grid place-items-center text-center">
        <div>
          <span ref={ref} className="block leading-none font-semibold tracking-[-0.05em] tabular-nums" style={{ fontSize: size * 0.3 }}>
            {value}
          </span>
          <span className="mt-1 block text-xs text-subtle tabular-nums">/ 100</span>
        </div>
      </div>
    </div>
  );
}
