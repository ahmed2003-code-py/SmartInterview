import { Link } from "react-router-dom";
import { ArrowRight, BarChart3, MessagesSquare, Mic, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/ui/states";
import { InterviewList } from "@/features/dashboard/InterviewList";
import { ScoreTrend, type TrendPoint } from "@/features/dashboard/ScoreTrend";
import { CRITERIA_ORDER, ScoreBars } from "@/features/report/ScoreBars";
import { useFetch } from "@/hooks/useFetch";
import { api, type Criterion, type InterviewSummary } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/i18n";
import { CountUp, Reveal, m, fadeUp, stagger } from "@/lib/motion";
import { cn } from "@/lib/utils";

interface DashboardData {
  totalInterviews: number;
  averageScore: number | null;
  bestScore: number | null;
  practiceSeconds: number;
  skills: Record<Criterion, number> | null;
  trend: TrendPoint[];
  recent: InterviewSummary[];
}

function Panel({ title, subtitle, children, className }: { title: string; subtitle?: string; children: React.ReactNode; className?: string }) {
  return (
    <section className={cn("rounded-2xl border border-border bg-surface p-5 sm:p-6", className)}>
      <div className="mb-4 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
        <h2 className="t-section">{title}</h2>
        {subtitle && <p className="text-[12.5px] text-subtle">{subtitle}</p>}
      </div>
      {children}
    </section>
  );
}

function Metric({ label, value, loading, format, suffix }: { label: string; value: number | null; loading: boolean; format?: (n: number) => string; suffix?: string }) {
  return (
    <m.div variants={fadeUp} className="min-w-0 px-4 py-4 sm:px-5 sm:py-5">
      <dt className="t-label truncate">{label}</dt>
      <dd className="t-metric mt-2.5 flex items-baseline gap-1">
        {loading ? <Skeleton className="h-8 w-14" /> : value == null ? <span className="text-subtle">—</span> : <CountUp value={value} format={format} />}
        {!loading && value != null && suffix && <span className="text-sm font-medium tracking-normal text-subtle">{suffix}</span>}
      </dd>
    </m.div>
  );
}

/** First visit: no fake numbers or empty charts, just what you'll get and one clear action. */
function EmptyDashboard() {
  const { d } = useI18n();
  const icons = [Mic, MessagesSquare, BarChart3];
  return (
    <Reveal className="mt-8 overflow-hidden rounded-2xl border border-border bg-surface">
      <div className="dot-grid relative px-6 py-12 text-center sm:px-10 sm:py-16">
        <div className="mx-auto max-w-md">
          <span className="ai-gradient mx-auto grid size-12 place-items-center rounded-2xl text-white shadow-md">
            <Mic className="size-5" />
          </span>
          <h2 className="t-display mt-6 text-balance">{d.dashboard.emptyTitle}</h2>
          <p className="mt-3 text-[15px] text-muted text-pretty">{d.dashboard.emptyBody}</p>
          <Button asChild size="lg" className="mt-7">
            <Link to="/interviews/new">
              {d.dashboard.firstInterview}
              <ArrowRight className="size-4 rtl:-scale-x-100" />
            </Link>
          </Button>
        </div>
      </div>
      <m.ol initial="hidden" whileInView="show" viewport={{ once: true }} variants={stagger(0.08)} className="grid border-t border-border sm:grid-cols-3">
        {d.dashboard.emptySteps.map((s, i) => {
          const Icon = icons[i];
          return (
            <m.li key={s} variants={fadeUp} className="flex items-center gap-3 border-border px-6 py-5 not-first:border-t sm:not-first:border-s sm:not-first:border-t-0">
              <Icon className="size-[18px] shrink-0 text-primary" />
              <span className="text-sm font-medium">{s}</span>
            </m.li>
          );
        })}
      </m.ol>
    </Reveal>
  );
}

export default function Dashboard() {
  const { d, fmt, lang, formatDuration } = useI18n();
  const { user } = useAuth();
  const { data, loading, error, reload } = useFetch(() => api.get<DashboardData>("/dashboard"), []);
  const firstName = user?.name.split(" ")[0] ?? "";
  const inProgress = data?.recent.find((i) => i.status === "IN_PROGRESS");
  const isEmpty = !loading && data && data.recent.length === 0;
  const lastChange = data?.recent.find((i) => i.status === "COMPLETED")?.change;
  const hour = new Date().getHours();
  const greeting = hour < 12 ? d.dashboard.greetMorning : hour < 18 ? d.dashboard.greetAfternoon : d.dashboard.greetEvening;
  // One deterministic recommendation: the lowest average skill (only with real data and a real gap).
  const lowest = data?.skills ? CRITERIA_ORDER.reduce((a, b) => (data.skills![b] < data.skills![a] ? b : a)) : null;
  const weakest = lowest && Math.max(...CRITERIA_ORDER.map((c) => data!.skills![c])) - data!.skills![lowest] >= 5 ? lowest : null;
  const subtitle =
    lastChange != null && lastChange > 0 ? fmt(d.dashboard.subtitleUp, { n: lastChange }) : data?.totalInterviews === 1 ? d.dashboard.subtitleFirst : d.dashboard.subtitle;

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-4">
        <div className="min-w-0">
          <h1 className="t-page text-balance">{fmt(isEmpty ? d.dashboard.welcomeNew : greeting, { name: firstName })}</h1>
          {!isEmpty && <p className="mt-1.5 text-[15px] text-muted">{loading ? " " : subtitle}</p>}
          {!loading && user && !user.targetRole && (
            <Link to="/profile" className="mt-2 inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline">
              {d.dashboard.recoProfile}
              <ArrowRight className="size-3.5 rtl:-scale-x-100" />
            </Link>
          )}
        </div>
        {!isEmpty && (
          <Button asChild size="lg" className="max-sm:hidden">
            <Link to="/interviews/new">
              <Plus className="size-4" />
              {d.nav.newInterview}
            </Link>
          </Button>
        )}
      </div>

      {error ? (
        <ErrorState className="mt-10" onRetry={reload} />
      ) : isEmpty ? (
        <EmptyDashboard />
      ) : (
        <>
          {inProgress && (
            <Link
              to={`/interviews/${inProgress.id}`}
              className="lift group mt-6 flex items-center justify-between gap-4 rounded-2xl border border-primary/25 bg-primary-soft/60 px-5 py-4"
            >
              <div className="flex min-w-0 items-center gap-3">
                <span className="relative flex size-2.5 shrink-0">
                  <span className="absolute inset-0 animate-ping rounded-full bg-primary/50" />
                  <span className="relative size-2.5 rounded-full bg-primary" />
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-medium">{d.dashboard.continueTitle}</p>
                  <p className="truncate text-sm text-muted">
                    {fmt(d.dashboard.continueBody, {
                      role: lang === "ar" ? inProgress.role.nameAr : inProgress.role.nameEn,
                      n: inProgress._count.questions,
                      total: { quick: 4, standard: 6, full: 10 }[inProgress.length],
                    })}
                  </p>
                </div>
              </div>
              <span className="flex shrink-0 items-center gap-1.5 text-sm font-medium text-primary">
                {d.dashboard.continue}
                <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5 rtl:-scale-x-100 rtl:group-hover:-translate-x-0.5" />
              </span>
            </Link>
          )}

          {/* Overview metrics */}
          <m.dl
            initial="hidden"
            animate="show"
            variants={stagger(0.05)}
            className="mt-6 grid grid-cols-2 overflow-hidden rounded-2xl border border-border bg-surface sm:grid-cols-4 [&>*]:border-border max-sm:[&>*:nth-child(n+3)]:border-t max-sm:[&>*:nth-child(even)]:border-s sm:[&>*:not(:first-child)]:border-s"
          >
            <Metric label={d.dashboard.totalInterviews} value={data?.totalInterviews ?? null} loading={loading} />
            <Metric label={d.dashboard.averageScore} value={data?.averageScore ?? null} loading={loading} />
            <Metric label={d.dashboard.bestScore} value={data?.bestScore ?? null} loading={loading} />
            <Metric
              label={d.dashboard.practiceTime}
              value={data ? Math.round(data.practiceSeconds / 60) : null}
              loading={loading}
              format={(n) => formatDuration(n * 60)}
            />
          </m.dl>

          {/* Performance + skills */}
          <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1.65fr)_minmax(0,1fr)]">
            <Panel title={d.dashboard.trendTitle} subtitle={data && data.trend.length > 1 ? fmt(d.dashboard.trendSubtitle, { n: data.trend.length }) : undefined}>
              {loading || !data ? (
                <Skeleton className="h-[220px] w-full" />
              ) : data.trend.length > 1 ? (
                <ScoreTrend points={data.trend} />
              ) : (
                <div className="grid h-[220px] place-items-center rounded-xl border border-dashed border-border-strong text-center">
                  <div className="px-6">
                    <BarChart3 className="mx-auto size-5 text-subtle" />
                    <p className="mt-3 max-w-xs text-sm text-muted">{d.dashboard.trendOne}</p>
                  </div>
                </div>
              )}
            </Panel>
            <Panel title={d.dashboard.skillsTitle} subtitle={d.dashboard.skillsSubtitle}>
              {loading || !data ? (
                <div className="space-y-5">
                  {Array.from({ length: 5 }, (_, i) => (
                    <Skeleton key={i} className="h-6 w-full" />
                  ))}
                </div>
              ) : data.skills ? (
                <>
                  <ScoreBars scores={data.skills} compact />
                  {weakest && (
                    <div className="mt-5 border-t border-border pt-4">
                      <p className="text-sm font-medium">{fmt(d.dashboard.recoWeakest, { skill: d.criteria[weakest] })}</p>
                      <p className="t-caption mt-0.5">{d.dashboard.recoWeakestBody}</p>
                      <Link to="/interviews/new" className="mt-2.5 inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline">
                        {d.dashboard.recoAction}
                        <ArrowRight className="size-3.5 rtl:-scale-x-100" />
                      </Link>
                    </div>
                  )}
                </>
              ) : (
                <p className="text-sm text-muted">{d.dashboard.trendOne}</p>
              )}
            </Panel>
          </div>

          <section className="mt-10">
            <div className="mb-3 flex items-baseline justify-between">
              <h2 className="t-section">{d.dashboard.recentTitle}</h2>
              <Link to="/history" className="text-sm text-muted transition-colors hover:text-fg">
                {d.dashboard.viewAll}
              </Link>
            </div>
            {loading || !data ? (
              <div className="divide-y divide-border rounded-2xl border border-border bg-surface">
                {Array.from({ length: 4 }, (_, i) => (
                  <div key={i} className="flex items-center justify-between px-5 py-4">
                    <div className="space-y-2">
                      <Skeleton className="h-4 w-44" />
                      <Skeleton className="h-3 w-60" />
                    </div>
                    <Skeleton className="h-6 w-8" />
                  </div>
                ))}
              </div>
            ) : (
              <InterviewList items={data.recent} />
            )}
          </section>
        </>
      )}
    </div>
  );
}
