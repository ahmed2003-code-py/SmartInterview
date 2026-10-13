import { Link, useSearchParams } from "react-router-dom";
import { History as HistoryIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState, ErrorState } from "@/components/ui/states";
import { InterviewList } from "@/features/dashboard/InterviewList";
import { useFetch } from "@/hooks/useFetch";
import { api, type InterviewSummary, type Role } from "@/lib/api";
import { useI18n } from "@/i18n";
import { PageHeader } from "@/components/layout/PageHeader";

export default function History() {
  const { d, lang } = useI18n();
  const [params, setParams] = useSearchParams();
  const roleId = params.get("role") ?? "";
  const language = params.get("lang") ?? "";
  const status = params.get("status") ?? "";

  const roles = useFetch(() => api.get<{ roles: Role[] }>("/roles"), []);
  const query = new URLSearchParams({ ...(roleId && { roleId }), ...(language && { language }), ...(status && { status }) }).toString();
  const list = useFetch(() => api.get<{ interviews: InterviewSummary[] }>(`/interviews?${query}`), [query]);

  const setFilter = (key: string) => (value: string) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    setParams(next, { replace: true });
  };
  const filtered = Boolean(roleId || language || status);

  return (
    <div className="animate-fade-up">
      <PageHeader title={d.history.title} />

      <div className="mt-6 flex flex-wrap gap-2">
        <Select
          label={d.history.role}
          value={roleId}
          onChange={setFilter("role")}
          placeholder={d.history.allRoles}
          className="min-w-44"
          options={(roles.data?.roles ?? []).map((r) => ({ value: r.id, label: lang === "ar" ? r.nameAr : r.nameEn }))}
        />
        <Select
          label={d.history.language}
          value={language}
          onChange={setFilter("lang")}
          placeholder={d.history.allLanguages}
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

      <div className="mt-6">
        {list.error ? (
          <ErrorState onRetry={list.reload} />
        ) : list.loading || !list.data ? (
          <div className="divide-y divide-border">
            {Array.from({ length: 5 }, (_, i) => (
              <div key={i} className="flex items-center justify-between px-4 py-4">
                <Skeleton className="h-4 w-48" />
                <Skeleton className="h-5 w-10" />
              </div>
            ))}
          </div>
        ) : list.data.interviews.length === 0 ? (
          <EmptyState
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
          <InterviewList items={list.data.interviews} showHeader />
        )}
      </div>
    </div>
  );
}
