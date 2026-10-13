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
    <section className="border-t border-border py-8">
      <div className="mb-4 flex items-baseline justify-between gap-4">
        <div>
          <h2 className="font-medium">{title}</h2>
          {hint && <p className="mt-0.5 text-sm text-muted">{hint}</p>}
        </div>
        {aside}
      </div>
      {children}
    </section>
  );
}

/** Role row with a radio indicator. */
function RoleOption({ selected, onSelect, title, hint }: { selected: boolean; onSelect: () => void; title: string; hint?: string }) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onSelect}
      className={cn(
        "flex items-start gap-3 rounded-lg border px-4 py-3.5 text-start transition-colors outline-none focus-visible:ring-3 focus-visible:ring-primary/25",
        selected ? "border-primary bg-primary-soft/45" : "border-border bg-surface hover:border-border-strong",
      )}
    >
      <span className={cn("mt-[3px] grid size-4 shrink-0 place-items-center rounded-full border", selected ? "border-primary" : "border-border-strong")}>
        {selected && <span className="size-2 rounded-full bg-primary" />}
      </span>
      <span>
        <span className="block text-sm font-medium">{title}</span>
        {hint && <span className="mt-0.5 block text-[13px] leading-snug text-muted">{hint}</span>}
      </span>
    </button>
  );
}

/** Compact segmented control for short single-choice settings. */
function Segmented<T extends string>({ value, onChange, options, label }: { value: T; onChange: (v: T) => void; options: { value: T; label: string }[]; label: string }) {
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex w-full rounded-lg border border-border bg-surface-2 p-1 sm:w-auto">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            "h-9 flex-1 rounded-md px-5 text-sm whitespace-nowrap transition-colors outline-none focus-visible:ring-3 focus-visible:ring-primary/25 sm:flex-none",
            value === o.value ? "bg-surface font-medium text-fg shadow-sm ring-1 ring-border" : "text-muted hover:text-fg",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export default function Setup() {
  const { d, lang } = useI18n();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const roles = useFetch(() => api.get<{ roles: Role[] }>("/roles"), []);

  const [roleId, setRoleId] = useState<string | null>(params.get("role"));
  // "smart" = bilingual: starts in the UI language, then the interviewer follows the student.
  const [language, setLanguage] = useState<Lang | "smart">((params.get("mode") === "smart" ? "smart" : (params.get("lang") as Lang)) || lang);
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
      const { interview } = await api.post<{ interview: InterviewDTO }>("/interviews", { roleId, language: language === "smart" ? lang : language, languageMode: language === "smart" ? "smart" : "fixed", difficulty, length, jobDescription: jd.trim() || null });
      navigate(`/interviews/${interview.id}`, { state: { autoStart: true } });
    } catch (err) {
      const msg = err instanceof ApiError && err.code === "NETWORK_ERROR" ? d.room.errors.network : err instanceof ApiError && err.code === "AI_FAILED" ? d.room.errors.aiFailed : d.room.errors.generic;
      toast.error(msg, { action: { label: d.common.retry, onClick: start } });
      setBusy(false);
    }
  }

  const summary: [string, string][] = [
    [d.setup.role, role ? roleName(role) : "—"],
    [d.setup.language, language === "smart" ? d.setup.smart : d.langs[language]],
    [d.setup.difficulty, d.levels[difficulty]],
    [d.setup.length, d.lengthHints[length]],
  ];

  return (
    <div className="animate-fade-up">
      <h1 className="font-display text-[2.3rem] leading-tight font-[450] sm:text-[2.75rem]">{d.setup.title}</h1>
      <p className="mt-2 text-muted">{d.setup.subtitle}</p>

      <div className="mt-10 grid gap-10 lg:grid-cols-[1fr_300px] lg:gap-16">
        <div>
          <Section title={d.setup.role} hint={d.setup.roleHint}>
            {roles.error ? (
              <ErrorState onRetry={roles.reload} className="py-6" />
            ) : (
              <div role="radiogroup" aria-label={d.setup.role} className="grid gap-2 sm:grid-cols-2">
                {roles.loading || !roles.data
                  ? Array.from({ length: 8 }, (_, i) => <Skeleton key={i} className="h-[68px]" />)
                  : roles.data.roles.map((r) => (
                      <RoleOption key={r.id} selected={roleId === r.id} onSelect={() => setRoleId(r.id)} title={roleName(r)} hint={lang === "ar" ? r.descriptionAr : r.descriptionEn} />
                    ))}
              </div>
            )}
          </Section>

          <Section title={d.setup.language}>
            <Segmented
              label={d.setup.language}
              value={language}
              onChange={setLanguage}
              options={[
                { value: "ar", label: "العربية" },
                { value: "en", label: "English" },
                { value: "smart", label: d.setup.smart },
              ]}
            />
            <p className="mt-3 text-sm text-muted">{language === "smart" ? d.setup.smartHint : d.setup.languageHint}</p>
          </Section>

          <Section title={d.setup.difficulty}>
            <Segmented label={d.setup.difficulty} value={difficulty} onChange={setDifficulty} options={DIFFICULTIES.map((v) => ({ value: v, label: d.levels[v] }))} />
            <p className="mt-3 text-sm text-muted">{d.levelHints[difficulty]}</p>
          </Section>

          <Section title={d.setup.length}>
            <Segmented label={d.setup.length} value={length} onChange={setLength} options={LENGTHS.map((v) => ({ value: v, label: d.lengths[v] }))} />
            <p className="mt-3 text-sm text-muted">{d.lengthHints[length]}</p>
          </Section>

          <Section title={d.setup.jd} hint={d.setup.jdHint} aside={<span className="shrink-0 text-xs text-subtle">{d.setup.optional}</span>}>
            <Textarea value={jd} onChange={(e) => setJd(e.target.value.slice(0, JD_MAX))} placeholder={d.setup.jdPlaceholder} rows={5} dir="auto" aria-label={d.setup.jd} />
            <p className="mt-1.5 text-end text-xs text-subtle tabular-nums">
              {jd.length} / {JD_MAX}
            </p>
          </Section>
        </div>

        <aside className="lg:sticky lg:top-24 lg:self-start lg:pt-8">
          <div className="rounded-xl border border-border bg-surface p-5">
            <h2 className="text-[13px] text-subtle">{d.setup.summary}</h2>
            <dl className="mt-3 divide-y divide-border text-sm">
              {summary.map(([k, v]) => (
                <div key={k} className="flex justify-between gap-4 py-2.5">
                  <dt className="text-muted">{k}</dt>
                  <dd className="text-end font-medium">{v}</dd>
                </div>
              ))}
              {jd.trim() && (
                <div className="flex justify-between gap-4 py-2.5">
                  <dt className="text-muted">{d.setup.jd}</dt>
                  <dd className="text-end font-medium">{d.setup.customJd}</dd>
                </div>
              )}
            </dl>
            <Button size="lg" className="mt-4 w-full" disabled={!roleId} loading={busy} onClick={start}>
              {busy ? d.setup.starting : d.setup.start}
              {!busy && <ArrowRight className="size-4 rtl:-scale-x-100" />}
            </Button>
            {!roleId && <p className="mt-2 text-center text-xs text-subtle">{d.setup.chooseRole}</p>}
            <p className="mt-5 flex gap-2.5 border-t border-border pt-4 text-xs leading-relaxed text-muted">
              <Mic className="mt-px size-3.5 shrink-0 text-subtle" />
              {d.setup.micNote}
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}
