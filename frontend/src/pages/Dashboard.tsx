import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState, ErrorState } from "@/components/ui/states";
import { InterviewList } from "@/features/dashboard/InterviewList";
import { ScoreTrend, type TrendPoint } from "@/features/dashboard/ScoreTrend";
import { useFetch } from "@/hooks/useFetch";
import { api, type InterviewSummary } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/i18n";
import { PageHeader } from "@/components/layout/PageHeader";

interface DashboardData {
  totalInterviews: number;
  averageScore: number | null;
  bestScore: number | null;
  practiceSeconds: number;
  trend: TrendPoint[];
  recent: InterviewSummary[];
}

function Stat({ label, value, suffix, loading }: { label: string; value: string | number | null; suffix?: string; loading?: boolean }) {
  return (
    <div className="min-w-0 px-4 py-4 sm:px-5">
      <dt className="t-label truncate">{label}</dt>
      <dd className="t-metric mt-2">
        {loading ? <Skeleton className="h-9 w-16" /> : (value ?? "—")}
        {!loading && value != null && suffix && <span className="font-sans text-sm text-subtle">{suffix}</span>}
      </dd>
    </div>
  );
}

export default function Dashboard() {
  const { d, fmt, lang } = useI18n();
  const { user } = useAuth();
  const { data, loading, error, reload } = useFetch(() => api.get<DashboardData>("/dashboard"), []);
  const firstName = user?.name.split(" ")[0] ?? "";
  const inProgress = data?.recent.find((i) => i.status === "IN_PROGRESS");
  const isEmpty = !loading && data && data.recent.length === 0;

  return (
    <div className="animate-fade-up">
      <PageHeader
        title={fmt(d.dashboard.welcome, { name: firstName })}
        description={d.dashboard.subtitle}
        actions={
          <Button asChild size="lg">
            <Link to="/interviews/new">
              {d.nav.newInterview}
              <ArrowRight className="size-4 rtl:-scale-x-100" />
            </Link>
          </Button>
        }
      />

      {error ? (
        <ErrorState className="mt-10" onRetry={reload} />
      ) : isEmpty ? (
        <div className="mt-10 rounded-xl border border-dashed border-border-strong">
          <EmptyState
            title={d.dashboard.emptyTitle}
            body={d.dashboard.emptyBody}
            className="py-16"
            action={
              <Button asChild>
                <Link to="/interviews/new">{d.dashboard.firstInterview}</Link>
              </Button>
            }
          />
        </div>
      ) : (
        <>
          <dl className="mt-8 grid grid-cols-3 divide-x divide-border rounded-xl border border-border bg-surface rtl:divide-x-reverse">
            <Stat label={d.dashboard.totalInterviews} value={data?.totalInterviews ?? null} loading={loading} />
            <Stat label={d.dashboard.averageScore} value={data?.averageScore ?? null} loading={loading} />
            <Stat label={d.dashboard.bestScore} value={data?.bestScore ?? null} loading={loading} />
          </dl>

          {inProgress && (
            <Link
              to={`/interviews/${inProgress.id}`}
              className="group mt-6 flex items-center justify-between gap-4 rounded-lg border border-border bg-surface px-5 py-4 transition-colors hover:border-border-strong"
            >
              <div>
                <p className="text-sm font-medium">{d.dashboard.continueTitle}</p>
                <p className="text-sm text-muted">
                  {fmt(d.dashboard.continueBody, {
                    role: lang === "ar" ? inProgress.role.nameAr : inProgress.role.nameEn,
                    n: inProgress._count.questions,
                    total: { quick: 4, standard: 6, full: 10 }[inProgress.length],
                  })}
                </p>
              </div>
              <span className="flex shrink-0 items-center gap-1.5 text-sm font-medium text-primary">
                {d.dashboard.continue}
                <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5 rtl:-scale-x-100 rtl:group-hover:-translate-x-0.5" />
              </span>
            </Link>
          )}

          {(loading || (data && data.trend.length > 1)) && (
          <section className="mt-10">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="t-section">{d.dashboard.trendTitle}</h2>
              {data && data.trend.length > 1 && <p className="text-[13px] text-subtle">{fmt(d.dashboard.trendSubtitle, { n: data.trend.length })}</p>}
            </div>
            <div className="mt-4">
              {loading || !data ? (
                <Skeleton className="h-[220px] w-full" />
              ) : (
                <ScoreTrend points={data.trend} />
              )}
            </div>
          </section>
          )}

          <section className="mt-10">
            <div className="mb-3 flex items-baseline justify-between">
              <h2 className="t-section">{d.dashboard.recentTitle}</h2>
              <Link to="/history" className="text-sm text-muted hover:text-fg">
                {d.dashboard.viewAll}
              </Link>
            </div>
            {loading || !data ? (
              <div className="divide-y divide-border border-y border-border">
                {Array.from({ length: 4 }, (_, i) => (
                  <div key={i} className="flex items-center justify-between py-4">
                    <Skeleton className="h-4 w-48" />
                    <Skeleton className="h-5 w-8" />
                  </div>
                ))}
              </div>
            ) : (
              <InterviewList items={data.recent} showHeader />
            )}
          </section>
        </>
      )}
    </div>
  );
}
