import { Link } from "react-router-dom";
import { ChevronRight, RotateCcw } from "lucide-react";
import { Tooltip } from "@/components/ui/tooltip";
import { Badge } from "@/components/ui/badge";
import { Delta } from "@/features/viz/Delta";
import type { InterviewSummary } from "@/lib/api";
import { useI18n } from "@/i18n";
import { m, fadeUp, stagger } from "@/lib/motion";
import { cn, scoreTone } from "@/lib/utils";

export function interviewHref(i: { id: string; status: string }) {
  return i.status === "IN_PROGRESS" ? `/interviews/${i.id}` : `/interviews/${i.id}/report`;
}

/** New-interview link pre-filled with the same role, specialization and settings. */
export function practiceAgainHref(i: Pick<InterviewSummary, "role" | "specialization" | "language" | "languageMode" | "difficulty" | "length">) {
  const p = new URLSearchParams({
    ...(i.role.id ? { role: i.role.id } : { roleTitle: i.role.nameEn }),
    ...(i.specialization ? { spec: i.specialization } : {}),
    lang: i.language,
    ...(i.languageMode === "smart" ? { mode: "smart" } : {}),
    difficulty: i.difficulty,
    length: i.length,
  });
  return `/interviews/new?${p}`;
}

/** Interview rows: role (+ specialization), one meta line, score with a real change chip. */
export function InterviewList({ items, className, practiceAgain }: { items: InterviewSummary[]; className?: string; practiceAgain?: boolean }) {
  const { d, lang, formatDate, formatDuration } = useI18n();
  return (
    <m.ul initial="hidden" animate="show" variants={stagger(0.04)} className={cn("divide-y divide-border overflow-hidden rounded-2xl border border-border bg-surface", className)}>
      {items.map((i) => {
        const role = lang === "ar" ? i.role.nameAr : i.role.nameEn;
        const languageLabel = i.languageMode === "smart" ? d.setup.smart.split(" · ")[0] : d.langs[i.language];
        return (
          <m.li key={i.id} variants={fadeUp} className="flex items-stretch">
            <Link to={interviewHref(i)} className="group flex min-w-0 flex-1 items-center gap-4 px-4 py-3.5 transition-colors hover:bg-bg-subtle sm:px-5">
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
            {practiceAgain && i.status === "COMPLETED" && (
              <Tooltip content={d.history.practiceAgain}>
                <Link
                  to={practiceAgainHref(i)}
                  aria-label={d.history.practiceAgain}
                  className="grid w-12 shrink-0 place-items-center border-s border-border text-subtle transition-colors hover:bg-bg-subtle hover:text-primary sm:w-14"
                >
                  <RotateCcw className="size-4" />
                </Link>
              </Tooltip>
            )}
          </m.li>
        );
      })}
    </m.ul>
  );
}
