import type { Criterion } from "@/lib/api";
import { useI18n } from "@/i18n";
import { m, EASE } from "@/lib/motion";
import { cn } from "@/lib/utils";

export const CRITERIA_ORDER: Criterion[] = ["communication", "clarity", "relevance", "subjectKnowledge", "educationalReasoning"];

/**
 * Skill bars (0-100). One hue for magnitude; the weakest skill is marked so the eye lands on what to
 * practice. Bars grow from the reading-start edge when they scroll into view.
 */
export function ScoreBars({ scores, className, markWeakest = true, compact }: { scores: Record<Criterion, number>; className?: string; markWeakest?: boolean; compact?: boolean }) {
  const { d } = useI18n();
  const weakest = CRITERIA_ORDER.reduce((a, b) => (scores[b] < scores[a] ? b : a));
  const spread = Math.max(...CRITERIA_ORDER.map((c) => scores[c])) - scores[weakest];
  return (
    <dl className={cn(compact ? "space-y-3" : "space-y-4", className)}>
      {CRITERIA_ORDER.map((c, i) => {
        const weak = markWeakest && c === weakest && spread >= 5;
        return (
          <div key={c}>
            <div className="mb-1.5 flex items-baseline justify-between gap-3 text-sm">
              <dt className={cn("flex min-w-0 items-center gap-2", weak ? "text-fg" : "text-muted")}>
                <span className="truncate">{d.criteria[c]}</span>
                {weak && <span className="shrink-0 rounded-full bg-warning-soft px-1.5 py-px text-[10.5px] font-semibold text-warning">{d.dashboard.focusNext}</span>}
              </dt>
              <dd className="font-semibold tabular-nums">{scores[c]}</dd>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-surface-2">
              <m.div
                className={cn("h-full rounded-full", weak ? "bg-warning" : "bg-primary")}
                initial={{ width: 0 }}
                whileInView={{ width: `${scores[c]}%` }}
                viewport={{ once: true }}
                transition={{ duration: 0.6, delay: 0.05 * i, ease: EASE }}
              />
            </div>
          </div>
        );
      })}
    </dl>
  );
}
