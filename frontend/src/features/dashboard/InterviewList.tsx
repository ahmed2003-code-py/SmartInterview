import { Link } from "react-router-dom";
import { ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { InterviewSummary } from "@/lib/api";
import { useI18n } from "@/i18n";
import { cn, scoreTone } from "@/lib/utils";

export function interviewHref(i: { id: string; status: string }) {
  return i.status === "IN_PROGRESS" ? `/interviews/${i.id}` : `/interviews/${i.id}/report`;
}

/** Interview rows: a table-like grid on desktop, stacked rows on mobile. */
export function InterviewList({ items, showHeader, compact }: { items: InterviewSummary[]; showHeader?: boolean; compact?: boolean }) {
  const { d, lang, formatDate, formatDuration } = useI18n();
  // In compact mode (narrow panels) rows always use the stacked layout.
  const wide = compact ? "hidden" : "hidden md:block";
  const cols = compact ? "" : "md:grid md:grid-cols-[minmax(0,2.2fr)_1.1fr_0.9fr_1fr_0.8fr_0.7fr_20px] md:items-center md:gap-4";
  return (
    <div>
      {showHeader && (
        <div className={cn("hidden border-b border-border px-3 pb-2.5 text-xs text-subtle", cols)}>
          <span>{d.history.role}</span>
          <span>{d.history.date}</span>
          <span>{d.history.language}</span>
          <span>{d.history.difficulty}</span>
          <span>{d.history.duration}</span>
          <span className="text-end">{d.history.score}</span>
          <span />
        </div>
      )}
      <ul className={cn("divide-y divide-border border-b border-border", !showHeader && "border-t")}>
        {items.map((i) => (
          <li key={i.id}>
            <Link to={interviewHref(i)} className={cn("group -mx-px flex items-center gap-4 px-3 py-4 transition-colors hover:bg-surface", cols)}>
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{lang === "ar" ? i.role.nameAr : i.role.nameEn}</p>
                <p className={cn("mt-0.5 truncate text-[13px] text-muted", !compact && "md:hidden")}>
                  {formatDate(i.startedAt)} · {d.langs[i.language]} · {d.levels[i.difficulty]}
                  {i.durationSec ? ` · ${formatDuration(i.durationSec)}` : ""}
                </p>
              </div>
              <span className={cn(wide, "text-sm text-muted")}>{formatDate(i.startedAt)}</span>
              <span className={cn(wide, "text-sm text-muted")}>{d.langs[i.language]}</span>
              <span className={cn(wide, "text-sm text-muted")}>{d.levels[i.difficulty]}</span>
              <span className={cn(wide, "text-sm text-muted")}>{formatDuration(i.durationSec)}</span>
              <span className="shrink-0 text-end">
                {i.status === "COMPLETED" && i.overallScore != null ? (
                  <span className={cn("font-display text-[1.4rem] leading-none font-[450] tabular-nums", scoreTone(i.overallScore))}>{i.overallScore}</span>
                ) : (
                  <Badge tone="primary">{d.status[i.status]}</Badge>
                )}
              </span>
              <ChevronRight className={cn(wide, "size-4 text-subtle transition-transform group-hover:translate-x-0.5 rtl:-scale-x-100 rtl:group-hover:-translate-x-0.5")} />
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
