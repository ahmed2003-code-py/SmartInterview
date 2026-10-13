import { Link } from "react-router-dom";
import { ArrowRight, Mic, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState, ErrorState } from "@/components/ui/states";
import { InterviewList } from "@/features/dashboard/InterviewList";
import { ScoreTrend, type TrendPoint } from "@/features/dashboard/ScoreTrend";
import { useFetch } from "@/hooks/useFetch";
import { api, type InterviewSummary } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/i18n";

interface DashboardData {
  totalInterviews: number;
  averageScore: number | null;
  bestScore: number | null;
  practiceSeconds: number;
  trend: TrendPoint[];
  recent: InterviewSummary[];
}

function Stat({ label, value, suffix }: { label: string; value: string | number | null; suffix?: string }) {
  return (
    <div className="px-5 py-5 sm:px-6">
      <dt className="text-[13px] text-muted">{label}</dt>
      <dd className="mt-2 text-3xl font-semibold tracking-tight tabular-nums">
        {value ?? "—"}
        {value != null && suffix && <span className="text-base font-normal text-subtle">{suffix}</span>}
      </dd>
    </div>
  );
}

export default function Dashboard() {
  const { d, fmt, lang, formatDuration } = useI18n();
  const { user } = useAuth();
  const { data, loading, error, reload } = useFetch(() => api.get<DashboardData>("/dashboard"), []);
  const firstName = user?.name.split(" ")[0] ?? "";
  const inProgress = data?.recent.find((i) => i.status === "IN_PROGRESS");

  return (
    <div className="animate-fade-up">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-[1.75rem] font-semibold tracking-tight sm:text-3xl">{fmt(d.dashboard.welcome, { name: firstName })}</h1>
          <p className="mt-1.5 text-muted">{d.dashboard.subtitle}</p>
        </div>
        <Button asChild size="lg">
          <Link to="/interviews/new">
            <Plus className="size-4" />
            {d.nav.newInterview}
          </Link>
        </Button>
      </div>

      {error ? (
        <ErrorState className="mt-10" onRetry={reload} />
      ) : (
        <>
          <dl className="mt-8 grid grid-cols-2 overflow-hidden rounded-xl border border-border bg-surface lg:grid-cols-4 [&>*]:border-border max-lg:[&>*:nth-child(odd)]:border-e max-lg:[&>*:nth-child(-n+2)]:border-b lg:[&>*:not(:first-child)]:border-s">
            {loading || !data ? (
              Array.from({ length: 4 }, (_, i) => (
                <div key={i} className="px-6 py-5">
                  <Skeleton className="h-3.5 w-24" />
                  <Skeleton className="mt-3 h-8 w-16" />
                </div>
              ))
            ) : (
              <>
                <Stat label={d.dashboard.totalInterviews} value={data.totalInterviews} />
                <Stat label={d.dashboard.averageScore} value={data.averageScore} suffix=" / 100" />
                <Stat label={d.dashboard.bestScore} value={data.bestScore} suffix=" / 100" />
                <Stat label={d.dashboard.practiceTime} value={data.practiceSeconds ? formatDuration(data.practiceSeconds) : null} />
              </>
            )}
          </dl>

          {inProgress && (
            <div className="mt-6 flex flex-wrap items-center justify-between gap-4 rounded-xl border border-primary/25 bg-primary-soft/60 px-5 py-4">
              <div>
                <p className="font-medium">{d.dashboard.continueTitle}</p>
                <p className="text-sm text-muted">
                  {fmt(d.dashboard.continueBody, {
                    role: lang === "ar" ? inProgress.role.nameAr : inProgress.role.nameEn,
                    n: inProgress._count.questions,
                    total: { quick: 4, standard: 6, full: 10 }[inProgress.length],
                  })}
                </p>
              </div>
              <Button asChild variant="secondary" size="sm">
                <Link to={`/interviews/${inProgress.id}`}>
                  {d.dashboard.continue}
                  <ArrowRight className="size-4 rtl:-scale-x-100" />
                </Link>
              </Button>
            </div>
          )}

          {!loading && data && data.recent.length === 0 ? (
            <div className="mt-6 rounded-xl border border-dashed border-border-strong">
              <EmptyState
                icon={<Mic />}
                title={d.dashboard.emptyTitle}
                body={d.dashboard.emptyBody}
                action={
                  <Button asChild>
                    <Link to="/interviews/new">{d.common.startPracticing}</Link>
                  </Button>
                }
              />
            </div>
          ) : (
            <div className="mt-10 grid gap-10 lg:grid-cols-[1.25fr_1fr] lg:gap-8">
              <section className="min-w-0">
                <div className="mb-4">
                  <h2 className="font-semibold">{d.dashboard.trendTitle}</h2>
                  {data && data.trend.length > 1 && <p className="text-sm text-muted">{fmt(d.dashboard.trendSubtitle, { n: data.trend.length })}</p>}
                </div>
                <div className="rounded-xl border border-border bg-surface p-4 sm:p-5">
                  {loading || !data ? (
                    <Skeleton className="h-[220px] w-full" />
                  ) : data.trend.length < 2 ? (
                    <div className="grid h-[220px] place-items-center px-6 text-center text-sm text-muted">{d.dashboard.trendEmpty}</div>
                  ) : (
                    <ScoreTrend points={data.trend} />
                  )}
                </div>
              </section>

              <section>
                <div className="mb-4 flex items-baseline justify-between">
                  <h2 className="font-semibold">{d.dashboard.recentTitle}</h2>
                  <Link to="/history" className="text-sm font-medium text-primary hover:underline">
                    {d.dashboard.viewAll}
                  </Link>
                </div>
                <div className="overflow-hidden rounded-xl border border-border bg-surface">
                  {loading || !data ? (
                    <div className="divide-y divide-border">
                      {Array.from({ length: 4 }, (_, i) => (
                        <div key={i} className="flex items-center justify-between px-4 py-4">
                          <div>
                            <Skeleton className="h-4 w-36" />
                            <Skeleton className="mt-2 h-3 w-48" />
                          </div>
                          <Skeleton className="h-6 w-8" />
                        </div>
                      ))}
                    </div>
                  ) : (
                    <InterviewList items={data.recent} compact />
                  )}
                </div>
              </section>
            </div>
          )}
        </>
      )}
    </div>
  );
}
