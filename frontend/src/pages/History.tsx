import { useMemo } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { History as HistoryIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState, ErrorState } from "@/components/ui/states";
import { InterviewList } from "@/features/dashboard/InterviewList";
import { useFetch } from "@/hooks/useFetch";
import { api, type InterviewSummary } from "@/lib/api";
import { useI18n } from "@/i18n";
import { PageHeader } from "@/components/layout/PageHeader";

export default function History() {
  const { d, lang, fmt } = useI18n();
  const [params, setParams] = useSearchParams();
  const role = params.get("role") ?? "";
  const language = params.get("lang") ?? "";
  const status = params.get("status") ?? "";

  // The list is small (≤100 per student), so filtering happens here. That also makes the role
  // filter list the roles the student actually practiced, custom ones included.
  const list = useFetch(() => api.get<{ interviews: InterviewSummary[] }>("/interviews"), []);
  const roleName = (i: InterviewSummary) => (lang === "ar" ? i.role.nameAr : i.role.nameEn);
  const all = list.data?.interviews ?? [];
  const roleOptions = useMemo(() => [...new Set(all.map(roleName))].sort().map((r) => ({ value: r, label: r })), [all, lang]); // eslint-disable-line react-hooks/exhaustive-deps
  const items = all.filter((i) => (!role || roleName(i) === role) && (!language || i.language === language) && (!status || i.status === status));

  const setFilter = (key: string) => (value: string) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    setParams(next, { replace: true });
  };
  const filtered = Boolean(role || language || status);

  return (
    <div>
      <PageHeader title={d.history.title} description={list.data ? fmt(d.history.subtitle, { n: all.length }) : " "} />

      {all.length > 0 && (
        <div className="mt-6 flex flex-wrap gap-2">
          <Select label={d.history.role} value={role} onChange={setFilter("role")} placeholder={d.history.allRoles} className="min-w-44 max-sm:flex-1" options={roleOptions} />
          <Select
            label={d.history.language}
            value={language}
            onChange={setFilter("lang")}
            placeholder={d.history.allLanguages}
            className="max-sm:flex-1"
            options={[
              { value: "ar", label: d.langs.ar },
              { value: "en", label: d.langs.en },
            ]}
          />
          <Select
            label={d.history.allStatuses}
            value={status}
            onChange={setFilter("status")}
            placeholder={d.history.allStatuses}
            options={[
              { value: "COMPLETED", label: d.status.COMPLETED },
              { value: "IN_PROGRESS", label: d.status.IN_PROGRESS },
            ]}
          />
          {filtered && (
            <Button variant="ghost" size="sm" className="h-9" onClick={() => setParams({}, { replace: true })}>
              {d.history.clearFilters}
            </Button>
          )}
        </div>
      )}

      <div className="mt-5">
        {list.error ? (
          <ErrorState onRetry={list.reload} />
        ) : list.loading || !list.data ? (
          <div className="divide-y divide-border rounded-2xl border border-border bg-surface">
            {Array.from({ length: 5 }, (_, i) => (
              <div key={i} className="flex items-center justify-between px-5 py-4">
                <div className="space-y-2">
                  <Skeleton className="h-4 w-44" />
                  <Skeleton className="h-3 w-60" />
                </div>
                <Skeleton className="h-6 w-8" />
              </div>
            ))}
          </div>
        ) : items.length === 0 ? (
          <EmptyState
            className="rounded-2xl border border-dashed border-border-strong"
            icon={<HistoryIcon />}
            title={filtered ? d.history.emptyFiltered : d.history.emptyTitle}
            body={filtered ? undefined : d.history.emptyBody}
            action={
              filtered ? (
                <Button variant="secondary" size="sm" onClick={() => setParams({}, { replace: true })}>
                  {d.history.clearFilters}
                </Button>
              ) : (
                <Button asChild>
                  <Link to="/interviews/new">{d.common.startPracticing}</Link>
                </Button>
              )
            }
          />
        ) : (
          <InterviewList items={items} practiceAgain />
        )}
      </div>
    </div>
  );
}
