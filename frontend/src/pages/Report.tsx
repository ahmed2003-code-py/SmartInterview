import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, ChevronDown, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState, ErrorState } from "@/components/ui/states";
import { ExpandableText } from "@/components/ui/expandable-text";
import { ScoreBars, CRITERIA_ORDER } from "@/features/report/ScoreBars";
import { useFetch } from "@/hooks/useFetch";
import { api, type InterviewDTO, type QuestionDTO } from "@/lib/api";
import { I18nOverride, useI18n } from "@/i18n";
import { cn, scoreBand, scoreTone, textDir } from "@/lib/utils";

function List({ title, items, marker, tone }: { title: string; items: string[]; marker: string; tone: string }) {
  return (
    <section>
      <h2 className="t-section">{title}</h2>
      <ul className="mt-3 space-y-2.5">
        {items.map((s, i) => (
          <li key={i} className="flex gap-2.5 text-[15px] leading-relaxed">
            <span className={cn("w-3 shrink-0 font-semibold", tone)} aria-hidden>
              {marker}
            </span>
            <span className="text-muted" dir={textDir(s)}>
              {s}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** One question in the review: collapsed to question + score; details on demand. */
function QuestionItem({ q, index }: { q: QuestionDTO; index: number }) {
  const { d, fmt } = useI18n();
  const [open, setOpen] = useState(false);
  const a = q.answer;
  return (
    <li className="border-b border-border last:border-b-0">
      <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} className="flex w-full items-start gap-4 px-4 py-4 text-start transition-colors hover:bg-bg-subtle sm:px-5">
        <span className="min-w-0 flex-1">
          <span className="t-caption flex items-center gap-2">
            {fmt(d.report.question, { n: index + 1 })}
            {q.kind === "FOLLOW_UP" && <Badge tone="neutral">{d.room.followUp}</Badge>}
          </span>
          <span className={cn("mt-1 block text-[15px] leading-relaxed font-medium", !open && "line-clamp-2")} dir={textDir(q.text)}>
            {q.text}
          </span>
        </span>
        {a?.score != null && <span className={cn("t-metric shrink-0 text-[1.5rem]", scoreTone(a.score))}>{a.score}</span>}
        <ChevronDown className={cn("mt-1 size-4 shrink-0 text-subtle transition-transform", open && "rotate-180")} />
      </button>
      {open && a && (
        <div className="space-y-5 px-4 pb-6 sm:px-5">
          <div>
            <p className="t-label mb-1.5">{d.report.yourAnswer}</p>
            <div className="border-s-2 border-border-strong ps-3">
              <ExpandableText text={a.transcript} lines={5} className="text-[15px] leading-relaxed text-muted" />
            </div>
          </div>
          {a.feedback && (
            <div>
              <p className="t-label mb-1.5">{d.report.feedback}</p>
              <p className="text-[15px] leading-relaxed" dir={textDir(a.feedback)}>
                {a.feedback}
              </p>
            </div>
          )}
          {a.suggestedAnswer && (
            <div className="rounded-lg bg-surface-2 p-4">
              <p className="t-label mb-1.5 text-fg">{d.report.suggested}</p>
              <p className="text-[15px] leading-relaxed" dir={textDir(a.suggestedAnswer)}>
                {a.suggestedAnswer}
              </p>
            </div>
          )}
          {a.scores && (
            <dl className="flex flex-wrap gap-x-5 gap-y-1.5 text-[13px]">
              {CRITERIA_ORDER.map((c) => (
                <div key={c} className="flex gap-1.5">
                  <dt className="text-subtle">{d.criteria[c]}</dt>
                  <dd className="font-medium tabular-nums">{a.scores![c]}/10</dd>
                </div>
              ))}
            </dl>
          )}
        </div>
      )}
    </li>
  );
}

function ReportSkeleton() {
  const { d } = useI18n();
  return (
    <div>
      <p className="t-caption">{d.report.preparing}</p>
      <Skeleton className="mt-4 h-8 w-64" />
      <Skeleton className="mt-3 h-4 w-80 max-w-full" />
      <Skeleton className="mt-8 h-48 w-full" />
    </div>
  );
}

export default function Report() {
  const { id } = useParams();
  const { data, loading, error, reload } = useFetch(() => api.get<{ interview: InterviewDTO }>(`/interviews/${id}`).then((r) => r.interview), [id]);
  if (loading) return <ReportSkeleton />;
  if (error || !data) return <ErrorState onRetry={reload} />;
  // The whole report (labels, direction, text) is shown in the language it was written in.
  const reportLang = data.report?.language ?? data.language;
  return (
    <I18nOverride lang={reportLang} scope="local">
      <ReportBody interview={data} />
    </I18nOverride>
  );
}

function ReportBody({ interview: i }: { interview: InterviewDTO }) {
  const { d, lang, fmt, formatDate, formatDuration } = useI18n();
  const roleName = lang === "ar" ? i.role.nameAr : i.role.nameEn;
  const backLink = (
    <Link to="/dashboard" className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-fg">
      <ArrowLeft className="size-4 rtl:-scale-x-100" />
      {d.nav.dashboard}
    </Link>
  );

  if (i.status !== "COMPLETED" || !i.report) {
    return (
      <div>
        {backLink}
        <EmptyState
          className="mt-8 rounded-xl border border-dashed border-border-strong"
          title={i.status === "IN_PROGRESS" ? d.report.notReady : d.room.endedNoReport}
          action={
            i.status === "IN_PROGRESS" ? (
              <Button asChild>
                <Link to={`/interviews/${i.id}`}>{d.report.continueInterview}</Link>
              </Button>
            ) : undefined
          }
        />
      </div>
    );
  }

  const r = i.report;
  const band = scoreBand(r.overallScore);
  const answered = i.questions.filter((q) => q.answer);
  const againParams = new URLSearchParams({ role: i.role.id, lang: i.language, ...(i.languageMode === "smart" ? { mode: "smart" } : {}), difficulty: i.difficulty, length: i.length });
  const bandTone = band === "excellent" || band === "good" ? "text-success" : band === "fair" ? "text-warning" : "text-danger";

  return (
    <div className="animate-fade-up">
      {backLink}

      {/* How did I do? */}
      <header className="mt-5 flex flex-wrap items-end justify-between gap-x-6 gap-y-4">
        <div className="min-w-0">
          <p className="t-caption">{d.report.title}</p>
          <h1 className="t-page mt-1 text-balance">{roleName}</h1>
          <p className="mt-1.5 text-sm text-muted">
            {formatDate(i.startedAt)} · {d.levels[i.difficulty]} · {formatDuration(i.durationSec)} · {fmt(d.common.questionsCount, { n: answered.length })}
          </p>
        </div>
        <Button asChild variant="secondary">
          <Link to={`/interviews/new?${againParams}`}>
            <RotateCcw className="size-4" />
            {d.report.practiceAgain}
          </Link>
        </Button>
      </header>

      <section className="mt-8 grid overflow-hidden rounded-xl border border-border bg-surface md:grid-cols-[240px_1fr]">
        <div className="flex items-center gap-5 border-b border-border p-5 md:flex-col md:items-start md:justify-center md:border-e md:border-b-0 md:p-7">
          <div>
            <p className="t-label">{d.report.overall}</p>
            <p className="t-metric mt-2 text-[3.25rem] md:text-[4rem]">
              {r.overallScore}
              <span className="font-sans text-lg text-subtle"> / 100</span>
            </p>
          </div>
          <p className={cn("text-sm font-medium", bandTone)}>{d.report.bands[band]}</p>
        </div>
        <div className="p-5 md:p-7">
          <h2 className="t-label mb-4">{d.report.categories}</h2>
          <ScoreBars scores={r.categoryScores} />
        </div>
      </section>

      {/* What am I good at / what to improve / what next */}
      <div className="mt-10 grid gap-8 md:grid-cols-3">
        <List title={d.report.strengths} items={r.strengths} marker="+" tone="text-success" />
        <List title={d.report.improvements} items={r.improvements} marker="–" tone="text-warning" />
        <List title={d.report.practice} items={r.practiceAreas} marker="→" tone="text-primary" />
      </div>

      {r.generalFeedback && (
        <p className="mt-10 max-w-3xl border-s-2 border-border-strong ps-4 text-[15px] leading-relaxed text-muted" dir={textDir(r.generalFeedback)}>
          {r.generalFeedback}
        </p>
      )}

      {/* Question-by-question review (collapsed) */}
      <section className="mt-12">
        <h2 className="t-section mb-3">{d.report.breakdown}</h2>
        <ol className="overflow-hidden rounded-xl border border-border bg-surface">
          {answered.map((q, idx) => (
            <QuestionItem key={q.id} q={q} index={idx} />
          ))}
        </ol>
        <p className="t-caption mt-4">{d.report.disclaimer}</p>
      </section>
    </div>
  );
}
