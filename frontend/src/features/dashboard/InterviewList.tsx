import { Link } from "react-router-dom";
import { ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Delta } from "@/features/viz/Delta";
import type { InterviewSummary } from "@/lib/api";
import { useI18n } from "@/i18n";
import { m, fadeUp, stagger } from "@/lib/motion";
import { cn, scoreTone } from "@/lib/utils";

export function interviewHref(i: { id: string; status: string }) {
  return i.status === "IN_PROGRESS" ? `/interviews/${i.id}` : `/interviews/${i.id}/report`;
}

/** Interview rows: role (+ specialization), one meta line, score with a real change chip. */
export function InterviewList({ items, className }: { items: InterviewSummary[]; className?: string }) {
  const { d, lang, formatDate, formatDuration } = useI18n();
  return (
    <m.ul initial="hidden" animate="show" variants={stagger(0.04)} className={cn("divide-y divide-border overflow-hidden rounded-2xl border border-border bg-surface", className)}>
      {items.map((i) => {
        const role = lang === "ar" ? i.role.nameAr : i.role.nameEn;
        const languageLabel = i.languageMode === "smart" ? d.setup.smart.split(" · ")[0] : d.langs[i.language];
        return (
          <m.li key={i.id} variants={fadeUp}>
            <Link to={interviewHref(i)} className="group flex items-center gap-4 px-4 py-3.5 transition-colors hover:bg-bg-subtle sm:px-5">
              <div className="min-w-0 flex-1">
                <p className="flex min-w-0 items-baseline gap-2">
                  <span className="truncate font-medium" dir="auto">
                    {role}
                  </span>
                  {i.specialization && (
                    <span className="hidden truncate text-sm text-subtle sm:inline" dir="auto">
                      · {i.specialization}
                    </span>
                  )}
                </p>
                <p className="mt-0.5 truncate text-[13px] text-muted">
                  {formatDate(i.startedAt)} · {languageLabel} · {d.levels[i.difficulty]}
                  {i.durationSec ? ` · ${formatDuration(i.durationSec)}` : ""}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2.5">
                {i.change != null && <Delta value={i.change} title={d.report.vsPrevious} className="hidden sm:inline-flex" />}
                {i.status === "COMPLETED" && i.overallScore != null ? (
                  <span className={cn("min-w-8 text-end text-xl font-semibold tracking-[-0.03em] tabular-nums", scoreTone(i.overallScore))}>{i.overallScore}</span>
                ) : (
                  <Badge tone="primary">{d.status[i.status]}</Badge>
                )}
                <ChevronRight className="size-4 text-subtle transition-transform group-hover:translate-x-0.5 rtl:-scale-x-100 rtl:group-hover:-translate-x-0.5" />
              </div>
            </Link>
          </m.li>
        );
      })}
    </m.ul>
  );
}
