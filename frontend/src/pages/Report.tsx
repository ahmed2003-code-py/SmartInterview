import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, ChevronDown, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState, ErrorState } from "@/components/ui/states";
import { ScoreBars, CRITERIA_ORDER } from "@/features/report/ScoreBars";
import { useFetch } from "@/hooks/useFetch";
import { api, type InterviewDTO, type QuestionDTO } from "@/lib/api";
import { useI18n } from "@/i18n";
import { cn, scoreBand, scoreTone } from "@/lib/utils";

const bandTone = { excellent: "success", good: "success", fair: "warning", needsWork: "danger" } as const;

function ListBlock({ title, items, marker }: { title: string; items: string[]; marker: string }) {
  return (
    <div>
      <h3 className="font-semibold">{title}</h3>
      <ul className="mt-3 space-y-2.5">
        {items.map((s, i) => (
          <li key={i} className="flex gap-3 text-[15px] leading-relaxed" dir="auto">
            <span className={cn("mt-[0.6em] size-1.5 shrink-0 rounded-full", marker)} />
            <span className="text-muted">{s}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function QuestionItem({ q, index }: { q: QuestionDTO; index: number }) {
  const { d } = useI18n();
  const [open, setOpen] = useState(index === 0);
  const a = q.answer;
  return (
    <li className="border-b border-border last:border-b-0">
      <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} className="flex w-full items-start gap-4 px-4 py-4 text-start transition-colors hover:bg-bg-subtle sm:px-5">
        <span className="mt-0.5 w-6 shrink-0 text-sm text-subtle tabular-nums">{index + 1}</span>
        <span className="min-w-0 flex-1">
          {q.kind === "FOLLOW_UP" && (
            <Badge tone="primary" className="mb-1.5">
              {d.room.followUp}
            </Badge>
          )}
          <span className="block leading-relaxed font-medium" dir="auto">
            {q.text}
          </span>
        </span>
        {a?.score != null && <span className={cn("shrink-0 text-lg font-semibold tabular-nums", scoreTone(a.score))}>{a.score}</span>}
        <ChevronDown className={cn("mt-1 size-4 shrink-0 text-subtle transition-transform", open && "rotate-180")} />
      </button>
      {open && a && (
        <div className="space-y-5 px-4 pb-6 sm:ps-15 sm:pe-5">
          <div>
            <p className="text-xs font-medium text-subtle">{d.report.yourAnswer}</p>
            <p className="mt-1.5 border-s-2 border-border-strong ps-3 text-[15px] leading-relaxed text-muted" dir="auto">
              {a.transcript}
            </p>
          </div>
          {a.feedback && (
            <div>
              <p className="text-xs font-medium text-subtle">{d.report.feedback}</p>
              <p className="mt-1.5 text-[15px] leading-relaxed" dir="auto">
                {a.feedback}
              </p>
            </div>
          )}
          {a.suggestedAnswer && (
            <div className="rounded-lg bg-primary-soft/60 p-4">
              <p className="text-xs font-medium text-primary-soft-fg">{d.report.suggested}</p>
              <p className="mt-1.5 text-[15px] leading-relaxed" dir="auto">
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
  return (
    <div>
      <Skeleton className="h-4 w-32" />
      <Skeleton className="mt-4 h-9 w-72" />
      <Skeleton className="mt-3 h-4 w-96 max-w-full" />
      <div className="mt-10 grid gap-8 lg:grid-cols-[300px_1fr]">
        <Skeleton className="h-52" />
        <Skeleton className="h-52" />
      </div>
    </div>
  );
}

export default function Report() {
  const { id } = useParams();
  const { d, lang, fmt, formatDate, formatDuration } = useI18n();
  const { data, loading, error, reload } = useFetch(() => api.get<{ interview: InterviewDTO }>(`/interviews/${id}`).then((r) => r.interview), [id]);

  if (loading) return <ReportSkeleton />;
  if (error || !data) return <ErrorState onRetry={reload} />;

  const i = data;
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
  const againParams = new URLSearchParams({ role: i.role.id, lang: i.language, difficulty: i.difficulty, length: i.length });

  return (
    <div className="animate-fade-up">
      {backLink}
      <div className="mt-5 flex flex-wrap items-end justify-between gap-5">
        <div>
          <p className="text-sm font-medium text-primary">{d.report.title}</p>
          <h1 className="mt-1.5 text-[1.75rem] font-semibold tracking-tight sm:text-3xl">{roleName}</h1>
          <p className="mt-2 text-sm text-muted">
            {formatDate(i.startedAt, true)} · {d.langs[i.language]} · {d.levels[i.difficulty]} · {formatDuration(i.durationSec)} · {fmt(d.common.questionsCount, { n: answered.length })}
          </p>
        </div>
        <Button asChild variant="secondary">
          <Link to={`/interviews/new?${againParams}`}>
            <RotateCcw className="size-4" />
            {d.report.practiceAgain}
          </Link>
        </Button>
      </div>

      <section className="mt-10 grid overflow-hidden rounded-xl border border-border bg-surface lg:grid-cols-[320px_1fr]">
        <div className="flex flex-col justify-between border-b border-border p-6 sm:p-8 lg:border-e lg:border-b-0">
          <div>
            <p className="text-sm text-muted">{d.report.overall}</p>
            <p className="mt-2 text-6xl font-semibold tracking-tight tabular-nums">
              {r.overallScore}
              <span className="text-2xl font-normal text-subtle"> / 100</span>
            </p>
            <Badge tone={bandTone[band]} className="mt-4 px-2 py-1 text-[13px]">
              {d.report.bands[band]}
            </Badge>
          </div>
          <p className="mt-8 text-xs leading-relaxed text-subtle">{d.report.disclaimer}</p>
        </div>
        <div className="p-6 sm:p-8">
          <h2 className="mb-5 text-sm font-semibold">{d.report.categories}</h2>
          <ScoreBars scores={r.categoryScores} />
        </div>
      </section>

      <section className="mt-12 grid gap-10 md:grid-cols-2">
        <ListBlock title={d.report.strengths} items={r.strengths} marker="bg-success" />
        <ListBlock title={d.report.improvements} items={r.improvements} marker="bg-warning" />
      </section>

      <section className="mt-12 grid gap-10 border-t border-border pt-10 md:grid-cols-[1.6fr_1fr]">
        <div>
          <h2 className="font-semibold">{d.report.general}</h2>
          <p className="mt-3 text-[15px] leading-relaxed text-muted" dir="auto">
            {r.generalFeedback}
          </p>
        </div>
        <div>
          <h2 className="font-semibold">{d.report.practice}</h2>
          <ul className="mt-3 flex flex-wrap gap-2">
            {r.practiceAreas.map((p) => (
              <li key={p} className="rounded-md border border-border bg-surface px-2.5 py-1.5 text-sm" dir="auto">
                {p}
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="mt-12">
        <h2 className="mb-4 font-semibold">{d.report.breakdown}</h2>
        <ol className="overflow-hidden rounded-xl border border-border bg-surface">
          {answered.map((q, idx) => (
            <QuestionItem key={q.id} q={q} index={idx} />
          ))}
        </ol>
      </section>
    </div>
  );
}
