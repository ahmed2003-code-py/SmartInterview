import { useState, type ReactNode } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { ArrowRight, Mic } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/ui/states";
import { useFetch } from "@/hooks/useFetch";
import { api, ApiError, type Difficulty, type InterviewDTO, type Length, type Role } from "@/lib/api";
import { useI18n, type Lang } from "@/i18n";
import { cn } from "@/lib/utils";

const DIFFICULTIES: Difficulty[] = ["beginner", "intermediate", "advanced"];
const LENGTHS: Length[] = ["quick", "standard", "full"];
const JD_MAX = 2500;

function Section({ title, hint, aside, children }: { title: string; hint?: string; aside?: ReactNode; children: ReactNode }) {
  return (
    <section className="border-t border-border py-8 first:border-t-0 first:pt-0">
      <div className="mb-4 flex items-baseline justify-between gap-4">
        <div>
          <h2 className="font-semibold">{title}</h2>
          {hint && <p className="mt-0.5 text-sm text-muted">{hint}</p>}
        </div>
        {aside}
      </div>
      {children}
    </section>
  );
}

/** Selectable tile used for every single-choice option on this page. */
function Option({ selected, onSelect, title, hint, className }: { selected: boolean; onSelect: () => void; title: ReactNode; hint?: ReactNode; className?: string }) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onSelect}
      className={cn(
        "relative rounded-lg border bg-surface px-4 py-3 text-start transition-colors outline-none focus-visible:ring-3 focus-visible:ring-primary/25",
        selected ? "border-primary bg-primary-soft/50 ring-1 ring-primary" : "border-border hover:border-border-strong",
        className,
      )}
    >
      <span className="block text-sm font-medium">{title}</span>
      {hint && <span className="mt-0.5 block text-[13px] leading-snug text-muted">{hint}</span>}
    </button>
  );
}

export default function Setup() {
  const { d, lang } = useI18n();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const roles = useFetch(() => api.get<{ roles: Role[] }>("/roles"), []);

  const [roleId, setRoleId] = useState<string | null>(params.get("role"));
  const [language, setLanguage] = useState<Lang>((params.get("lang") as Lang) || lang);
  const [difficulty, setDifficulty] = useState<Difficulty>((params.get("difficulty") as Difficulty) || "beginner");
  const [length, setLength] = useState<Length>((params.get("length") as Length) || "quick");
  const [jd, setJd] = useState("");
  const [busy, setBusy] = useState(false);

  const role = roles.data?.roles.find((r) => r.id === roleId);
  const roleName = (r: Role) => (lang === "ar" ? r.nameAr : r.nameEn);

  async function start() {
    if (!roleId) return;
    setBusy(true);
    try {
      const { interview } = await api.post<{ interview: InterviewDTO }>("/interviews", { roleId, language, difficulty, length, jobDescription: jd.trim() || null });
      navigate(`/interviews/${interview.id}`);
    } catch (err) {
      const msg = err instanceof ApiError && err.code === "NETWORK_ERROR" ? d.room.errors.network : err instanceof ApiError && err.code === "AI_FAILED" ? d.room.errors.aiFailed : d.room.errors.generic;
      toast.error(msg, { action: { label: d.common.retry, onClick: start } });
      setBusy(false);
    }
  }

  const summary: [string, string][] = [
    [d.setup.role, role ? roleName(role) : "—"],
    [d.setup.language, d.langs[language]],
    [d.setup.difficulty, d.levels[difficulty]],
    [d.setup.length, d.lengthHints[length]],
  ];

  return (
    <div className="animate-fade-up">
      <h1 className="text-[1.75rem] font-semibold tracking-tight sm:text-3xl">{d.setup.title}</h1>
      <p className="mt-1.5 text-muted">{d.setup.subtitle}</p>

      <div className="mt-10 grid gap-10 lg:grid-cols-[1fr_300px] lg:gap-14">
        <div>
          <Section title={d.setup.role} hint={d.setup.roleHint}>
            {roles.error ? (
              <ErrorState onRetry={roles.reload} className="py-6" />
            ) : (
              <div role="radiogroup" aria-label={d.setup.role} className="grid gap-2.5 sm:grid-cols-2">
                {roles.loading || !roles.data
                  ? Array.from({ length: 8 }, (_, i) => <Skeleton key={i} className="h-[68px]" />)
                  : roles.data.roles.map((r) => (
                      <Option key={r.id} selected={roleId === r.id} onSelect={() => setRoleId(r.id)} title={roleName(r)} hint={lang === "ar" ? r.descriptionAr : r.descriptionEn} />
                    ))}
              </div>
            )}
          </Section>

          <Section title={d.setup.language} hint={d.setup.languageHint}>
            <div role="radiogroup" aria-label={d.setup.language} className="grid max-w-md grid-cols-2 gap-2.5">
              {(["ar", "en"] as Lang[]).map((l) => (
                <Option key={l} selected={language === l} onSelect={() => setLanguage(l)} title={l === "ar" ? "العربية" : "English"} className="text-center" />
              ))}
            </div>
          </Section>

          <Section title={d.setup.difficulty}>
            <div role="radiogroup" aria-label={d.setup.difficulty} className="grid gap-2.5 sm:grid-cols-3">
              {DIFFICULTIES.map((v) => (
                <Option key={v} selected={difficulty === v} onSelect={() => setDifficulty(v)} title={d.levels[v]} hint={d.levelHints[v]} />
              ))}
            </div>
          </Section>

          <Section title={d.setup.length}>
            <div role="radiogroup" aria-label={d.setup.length} className="grid gap-2.5 sm:grid-cols-3">
              {LENGTHS.map((v) => (
                <Option key={v} selected={length === v} onSelect={() => setLength(v)} title={d.lengths[v]} hint={d.lengthHints[v]} />
              ))}
            </div>
          </Section>

          <Section
            title={d.setup.jd}
            hint={d.setup.jdHint}
            aside={<span className="shrink-0 rounded-sm bg-surface-2 px-1.5 py-0.5 text-xs text-muted">{d.setup.optional}</span>}
          >
            <Textarea
              value={jd}
              onChange={(e) => setJd(e.target.value.slice(0, JD_MAX))}
              placeholder={d.setup.jdPlaceholder}
              rows={6}
              dir="auto"
              aria-label={d.setup.jd}
            />
            <p className="mt-1.5 text-end text-xs text-subtle tabular-nums">
              {jd.length} / {JD_MAX}
            </p>
          </Section>
        </div>

        <aside className="lg:sticky lg:top-24 lg:self-start">
          <div className="rounded-xl border border-border bg-surface p-5">
            <h2 className="text-sm font-semibold">{d.setup.summary}</h2>
            <dl className="mt-4 space-y-3 text-sm">
              {summary.map(([k, v]) => (
                <div key={k} className="flex justify-between gap-4">
                  <dt className="text-muted">{k}</dt>
                  <dd className="text-end font-medium">{v}</dd>
                </div>
              ))}
              {jd.trim() && (
                <div className="flex justify-between gap-4">
                  <dt className="text-muted">{d.setup.jd}</dt>
                  <dd className="text-end font-medium text-primary">{d.setup.customJd}</dd>
                </div>
              )}
            </dl>
            <Button size="lg" className="mt-6 w-full" disabled={!roleId} loading={busy} onClick={start}>
              {busy ? d.setup.starting : d.setup.start}
              {!busy && <ArrowRight className="size-4 rtl:-scale-x-100" />}
            </Button>
            {!roleId && <p className="mt-2 text-center text-xs text-subtle">{d.setup.chooseRole}</p>}
            <p className="mt-5 flex gap-2.5 border-t border-border pt-4 text-[13px] leading-relaxed text-muted">
              <Mic className="mt-0.5 size-4 shrink-0 text-subtle" />
              {d.setup.micNote}
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}
