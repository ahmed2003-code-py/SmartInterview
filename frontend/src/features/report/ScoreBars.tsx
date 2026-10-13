import type { Criterion } from "@/lib/api";
import { useI18n } from "@/i18n";
import { cn } from "@/lib/utils";

export const CRITERIA_ORDER: Criterion[] = ["communication", "clarity", "relevance", "subjectKnowledge", "educationalReasoning"];

function barColor(score: number) {
  if (score >= 70) return "bg-primary";
  if (score >= 50) return "bg-warning";
  return "bg-danger";
}

export function ScoreBars({ scores, className }: { scores: Record<Criterion, number>; className?: string }) {
  const { d } = useI18n();
  return (
    <dl className={cn("space-y-3.5", className)}>
      {CRITERIA_ORDER.map((c) => (
        <div key={c}>
          <div className="mb-1.5 flex items-baseline justify-between text-sm">
            <dt className="text-muted">{d.criteria[c]}</dt>
            <dd className="font-medium tabular-nums">{scores[c]}</dd>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-surface-2">
            <div className={cn("h-full rounded-full transition-[width] duration-700", barColor(scores[c]))} style={{ width: `${scores[c]}%` }} />
          </div>
        </div>
      ))}
    </dl>
  );
}
