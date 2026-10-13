import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, ArrowRight, Check, ChevronDown, CircleDot, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState, ErrorState } from "@/components/ui/states";
import { ExpandableText } from "@/components/ui/expandable-text";
import { ScoreBars, CRITERIA_ORDER } from "@/features/report/ScoreBars";
import { ScoreRing } from "@/features/viz/ScoreRing";
import { Delta } from "@/features/viz/Delta";
import { useFetch } from "@/hooks/useFetch";
import { api, type InterviewDTO, type QuestionDTO } from "@/lib/api";
import { I18nOverride, useI18n } from "@/i18n";
import { AnimatePresence, Reveal, m, fadeUp, stagger } from "@/lib/motion";
import { cn, scoreBand, scoreTone, textDir } from "@/lib/utils";

function List({ title, items, icon, tone }: { title: string; items: string[]; icon: React.ReactNode; tone: string }) {
  return (
    <m.section variants={fadeUp} className="border-t-2 pt-4" style={{ borderColor: "currentColor" }}>
      <h2 className={cn("t-section flex items-center gap-2", tone)}>{title}</h2>
      <ul className="mt-3 space-y-3">
        {items.map((s, i) => (
          <li key={i} className="flex gap-2.5 text-[15px] leading-relaxed">
            <span className={cn("mt-1 shrink-0", tone)} aria-hidden>
              {icon}
            </span>
            <span className="text-fg/85" dir={textDir(s)}>
              {s}
            </span>
          </li>
        ))}
      </ul>
    </m.section>
  );
}

const firstSentence = (s: string) => s.split(/(?<=[.!؟?])\s/)[0];

/** One question: collapsed to number, score and a one-line summary; details on demand. */
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
          {!open && a?.feedback && (
            <span className="mt-1 block truncate text-[13px] text-muted" dir={textDir(a.feedback)}>
              {firstSentence(a.feedback)}
            </span>
          )}
        </span>
        {a?.score != null && (
          <span className="shrink-0 text-end">
            <span className={cn("block text-xl leading-none font-semibold tracking-[-0.03em] tabular-nums", scoreTone(a.score))}>{a.score}</span>
            <span className="text-[11px] text-subtle">/100</span>
          </span>
        )}
        <ChevronDown className={cn("mt-1 size-4 shrink-0 text-subtle transition-transform duration-200", open && "rotate-180")} />
      </button>
      <AnimatePresence initial={false}>
        {open && a && (
          <m.div key="body" initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
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
                <div className="rounded-xl border border-primary/15 bg-primary-soft/50 p-4">
                  <p className="mb-1.5 text-[13px] font-semibold text-primary-soft-fg">{d.report.suggested}</p>
                  <p className="text-[15px] leading-relaxed" dir={textDir(a.suggestedAnswer)}>
                    {a.suggestedAnswer}
                  </p>
                </div>
              )}
              {a.scores && (
                <dl className="flex flex-wrap gap-1.5 text-[12.5px]">
                  {CRITERIA_ORDER.map((c) => (
                    <div key={c} className="flex gap-1.5 rounded-full bg-surface-2 px-2.5 py-1">
                      <dt className="text-muted">{d.criteria[c]}</dt>
                      <dd className="font-semibold tabular-nums">{a.scores![c]}/10</dd>
                    </div>
                  ))}
                </dl>
              )}
            </div>
          </m.div>
        )}
      </AnimatePresence>
    </li>
  );
}

function ReportSkeleton() {
  const { d } = useI18n();
  return (
    <div className="mx-auto max-w-5xl">
      <Skeleton className="h-4 w-24" />
      <div className="mt-6 flex flex-col gap-6 rounded-2xl border border-border bg-surface p-6 sm:flex-row sm:items-center">
        <Skeleton className="size-36 rounded-full" />
        <div className="flex-1 space-y-3">
          <p className="t-caption">{d.report.preparing}</p>
          <Skeleton className="h-8 w-64 max-w-full" />
          <Skeleton className="h-4 w-80 max-w-full" />
        </div>
      </div>
      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <Skeleton className="h-56" />
        <Skeleton className="h-56" />
      </div>
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
    <Link to="/dashboard" className="inline-flex items-center gap-1.5 text-sm text-muted transition-colors hover:text-fg">
      <ArrowLeft className="size-4 rtl:-scale-x-100" />
      {d.nav.dashboard}
    </Link>
  );

  if (i.status !== "COMPLETED" || !i.report) {
    return (
      <div className="mx-auto max-w-5xl">
        {backLink}
        <EmptyState
          className="mt-8 rounded-2xl border border-dashed border-border-strong"
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
  const againParams = new URLSearchParams({
    ...(i.role.id ? { role: i.role.id } : { roleTitle: i.role.nameEn }),
    ...(i.specialization ? { spec: i.specialization } : {}),
    lang: i.language,
    ...(i.languageMode === "smart" ? { mode: "smart" } : {}),
    difficulty: i.difficulty,
    length: i.length,
  });
  const bandTone = band === "excellent" || band === "good" ? "text-success" : band === "fair" ? "text-warning" : "text-danger";
  const delta = i.previousScore != null ? r.overallScore - i.previousScore : null;

  return (
    <div className="mx-auto max-w-5xl">
      {backLink}

      {/* Hero: how did I do? */}
      <m.header
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative mt-5 overflow-hidden rounded-2xl border border-border bg-surface"
      >
        <div className="dot-grid pointer-events-none absolute inset-y-0 end-0 w-1/2 opacity-60 [mask-image:linear-gradient(to_left,black,transparent)] rtl:[mask-image:linear-gradient(to_right,black,transparent)]" />
        <div className="relative flex flex-col gap-6 p-5 sm:flex-row sm:items-center sm:gap-8 sm:p-8">
          <ScoreRing score={r.overallScore} size={148} stroke={9} label={d.report.overall} className="mx-auto sm:mx-0" />
          <div className="min-w-0 flex-1 text-center sm:text-start">
            <p className="t-eyebrow">{d.report.title}</p>
            <h1 className={cn("t-page mt-2 text-balance break-words", roleName.length > 34 && "max-sm:text-[1.3rem]")} dir="auto">
              {roleName}
            </h1>
            {i.specialization && (
              <p className="mt-0.5 text-[15px] text-muted" dir="auto">
                {i.specialization}
              </p>
            )}
            <div className="mt-3 flex flex-wrap items-center justify-center gap-x-3 gap-y-2 sm:justify-start">
              <span className={cn("text-[15px] font-semibold", bandTone)}>{d.report.bandsLong[band]}</span>
              {delta != null && (
                <span className="flex items-center gap-1.5 text-[13px] text-muted">
                  <Delta value={delta} />
                  {d.report.vsPrevious}
                </span>
              )}
            </div>
            <p className="mt-3 text-[13px] text-subtle">
              {formatDate(i.startedAt)} · {formatDuration(i.durationSec)} · {d.levels[i.difficulty]} · {fmt(d.common.questionsCount, { n: answered.length })}
            </p>
          </div>
          <Button asChild variant="secondary" className="self-center sm:self-start">
            <Link to={`/interviews/new?${againParams}`}>
              <RotateCcw className="size-4" />
              {d.report.practiceAgain}
            </Link>
          </Button>
        </div>
      </m.header>

      {/* Skills + summary */}
      <div className="mt-4 grid gap-4 md:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
        <Reveal as="section" className="rounded-2xl border border-border bg-surface p-5 sm:p-6">
          <h2 className="t-section mb-5">{d.report.categories}</h2>
          <ScoreBars scores={r.categoryScores} />
        </Reveal>
        {r.generalFeedback && (
          <Reveal as="section" delay={0.08} className="flex flex-col rounded-2xl border border-border bg-surface p-5 sm:p-6">
            <h2 className="t-section mb-4">{d.report.summary}</h2>
            <p className="text-[15.5px] leading-relaxed text-fg/85" dir={textDir(r.generalFeedback)}>
              {r.generalFeedback}
            </p>
          </Reveal>
        )}
      </div>

      {/* What am I good at / what to improve / what next */}
      <m.div initial="hidden" whileInView="show" viewport={{ once: true, margin: "-8% 0px" }} variants={stagger(0.08)} className="mt-10 grid gap-8 md:grid-cols-3 md:gap-6">
        <div className="text-success">
          <List title={d.report.strengths} items={r.strengths} icon={<Check className="size-4" strokeWidth={2.5} />} tone="text-success" />
        </div>
        <div className="text-warning">
          <List title={d.report.improvements} items={r.improvements} icon={<CircleDot className="size-4" />} tone="text-warning" />
        </div>
        <div className="text-primary">
          <List title={d.report.practice} items={r.practiceAreas} icon={<ArrowRight className="size-4 rtl:-scale-x-100" />} tone="text-primary" />
        </div>
      </m.div>

      {/* Question-by-question review (collapsed) */}
      <Reveal as="section" className="mt-12">
        <h2 className="t-section mb-3">{d.report.breakdown}</h2>
        <ol className="overflow-hidden rounded-2xl border border-border bg-surface">
          {answered.map((q, idx) => (
            <QuestionItem key={q.id} q={q} index={idx} />
          ))}
        </ol>
        <p className="t-caption mt-4">{d.report.disclaimer}</p>
      </Reveal>
    </div>
  );
}
