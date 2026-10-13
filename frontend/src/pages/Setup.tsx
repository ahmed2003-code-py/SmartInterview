import { useRef, useState, type ReactNode } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { ArrowRight, Check, FileText, Mic, Plus, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { ErrorState } from "@/components/ui/states";
import { PageHeader } from "@/components/layout/PageHeader";
import { useFetch } from "@/hooks/useFetch";
import { api, ApiError, type Difficulty, type InterviewDTO, type Length, type Role } from "@/lib/api";
import { useI18n, type Lang } from "@/i18n";
import { cn } from "@/lib/utils";

const DIFFICULTIES: Difficulty[] = ["beginner", "intermediate", "advanced"];
const LENGTHS: Length[] = ["quick", "standard", "full"];
const QUESTION_COUNT: Record<Length, number> = { quick: 4, standard: 6, full: 10 };
const JD_MAX = 2500;
const CV_MAX = 5 * 1024 * 1024;

function Section({ step, title, children }: { step: number; title: string; children: ReactNode }) {
  return (
    <section className="border-t border-border py-7 first:border-t-0 first:pt-0">
      <h2 className="t-section mb-4 flex items-center gap-2.5">
        <span className="grid size-5 place-items-center rounded-full bg-surface-2 text-[11px] font-semibold text-muted tabular-nums">{step}</span>
        {title}
      </h2>
      <div className="space-y-5">{children}</div>
    </section>
  );
}

function Field({ label, optional, hint, children }: { label: string; optional?: string; hint?: string; children: ReactNode }) {
  return (
    <div>
      <div className="mb-2 flex items-baseline gap-2">
        <span className="t-label">{label}</span>
        {optional && <span className="t-caption">· {optional}</span>}
      </div>
      {children}
      {hint && <p className="t-caption mt-2">{hint}</p>}
    </div>
  );
}

/** Compact segmented control for short single-choice settings. */
function Segmented<T extends string>({ value, onChange, options, label }: { value: T; onChange: (v: T) => void; options: { value: T; label: string }[]; label: string }) {
  return (
    <div role="radiogroup" aria-label={label} className="grid w-full auto-cols-fr grid-flow-col rounded-lg border border-border bg-surface-2 p-1 sm:inline-grid sm:w-auto">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            "h-9 rounded-md px-4 text-sm whitespace-nowrap transition-colors outline-none focus-visible:ring-3 focus-visible:ring-primary/25",
            value === o.value ? "bg-surface font-medium text-fg shadow-sm ring-1 ring-border" : "text-muted hover:text-fg",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

type CvState = { status: "idle" } | { status: "reading"; name: string } | { status: "ready"; name: string; profile: string } | { status: "error"; message: string };

/** Optional CV: upload → server reads it → only a short profile is kept for the interview. */
function CvUpload({ cv, setCv }: { cv: CvState; setCv: (c: CvState) => void }) {
  const { d } = useI18n();
  const input = useRef<HTMLInputElement>(null);

  async function upload(file: File) {
    if (file.size > CV_MAX) return setCv({ status: "error", message: d.setup.cvTooBig });
    setCv({ status: "reading", name: file.name });
    const form = new FormData();
    form.append("cv", file, file.name);
    try {
      const res = await api.post<{ fileName: string; profile: string }>("/interviews/cv", form);
      setCv({ status: "ready", name: res.fileName, profile: res.profile });
    } catch (err) {
      const msg = err instanceof ApiError && err.status === 413 ? d.setup.cvTooBig : err instanceof ApiError && err.code === "NETWORK_ERROR" ? d.room.errors.network : d.setup.cvError;
      setCv({ status: "error", message: msg });
    }
  }

  const picker = (
    <input
      ref={input}
      type="file"
      accept=".pdf,.docx,.txt,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain"
      className="sr-only"
      aria-label={d.setup.cvUpload}
      onChange={(e) => {
        const f = e.target.files?.[0];
        e.target.value = "";
        if (f) upload(f);
      }}
    />
  );

  if (cv.status === "ready" || cv.status === "reading")
    return (
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-lg border border-border bg-surface px-3.5 py-3">
        <FileText className="size-5 shrink-0 text-subtle" strokeWidth={1.75} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium" dir="auto">
            {cv.name}
          </p>
          <p className={cn("mt-0.5 flex items-center gap-1.5 text-xs", cv.status === "ready" ? "text-success" : "text-muted")}>
            {cv.status === "ready" ? <Check className="size-3.5" /> : <Spinner className="size-3" />}
            {cv.status === "ready" ? d.setup.cvReady : d.setup.cvReading}
          </p>
        </div>
        {cv.status === "ready" && (
          <div className="flex shrink-0 gap-1">
            <Button variant="ghost" size="sm" onClick={() => input.current?.click()}>
              {d.setup.cvReplace}
            </Button>
            <Button variant="ghost" size="sm" className="text-danger hover:bg-danger-soft" onClick={() => setCv({ status: "idle" })}>
              {d.setup.cvRemove}
            </Button>
          </div>
        )}
        {picker}
      </div>
    );

  return (
    <div>
      <button
        type="button"
        onClick={() => input.current?.click()}
        className="flex w-full items-center gap-3 rounded-lg border border-dashed border-border-strong bg-surface px-4 py-4 text-start transition-colors outline-none hover:border-fg/40 focus-visible:ring-3 focus-visible:ring-primary/25"
      >
        <span className="grid size-9 shrink-0 place-items-center rounded-md bg-surface-2 text-muted">
          <Upload className="size-4" />
        </span>
        <span>
          <span className="block text-sm font-medium">{d.setup.cvUpload}</span>
          <span className="t-caption">{d.setup.cvTypes}</span>
        </span>
      </button>
      {cv.status === "error" && (
        <p className="mt-2 text-[13px] text-danger" role="alert">
          {cv.message}
        </p>
      )}
      {picker}
    </div>
  );
}

export default function Setup() {
  const { d, lang, fmt } = useI18n();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const roles = useFetch(() => api.get<{ roles: Role[] }>("/roles"), []);

  const [roleId, setRoleId] = useState<string | null>(params.get("role"));
  // "smart" = bilingual: starts in the UI language, then the interviewer follows the student.
  const [language, setLanguage] = useState<Lang | "smart">((params.get("mode") === "smart" ? "smart" : (params.get("lang") as Lang)) || lang);
  const [difficulty, setDifficulty] = useState<Difficulty>((params.get("difficulty") as Difficulty) || "beginner");
  const [length, setLength] = useState<Length>((params.get("length") as Length) || "quick");
  const [jdOpen, setJdOpen] = useState(false);
  const [jd, setJd] = useState("");
  const [cv, setCv] = useState<CvState>({ status: "idle" });
  const [busy, setBusy] = useState(false);

  const role = roles.data?.roles.find((r) => r.id === roleId);
  const roleName = (r: Role) => (lang === "ar" ? r.nameAr : r.nameEn);
  const canStart = Boolean(roleId) && cv.status !== "reading" && !busy;

  async function start() {
    if (!roleId) return;
    setBusy(true);
    try {
      const { interview } = await api.post<{ interview: InterviewDTO }>("/interviews", {
        roleId,
        language: language === "smart" ? lang : language,
        languageMode: language === "smart" ? "smart" : "fixed",
        difficulty,
        length,
        jobDescription: jd.trim() || null,
        cvProfile: cv.status === "ready" ? cv.profile : null,
      });
      navigate(`/interviews/${interview.id}`, { state: { autoStart: true } });
    } catch (err) {
      const msg = err instanceof ApiError && err.code === "NETWORK_ERROR" ? d.room.errors.network : err instanceof ApiError && err.code === "AI_FAILED" ? d.room.errors.aiFailed : d.room.errors.generic;
      toast.error(msg, { action: { label: d.common.retry, onClick: start } });
      setBusy(false);
    }
  }

  const languageLabel = language === "smart" ? d.setup.smart : d.langs[language];
  const extras = [cv.status === "ready" ? d.setup.cvAdded : null, jd.trim() ? d.setup.jdAdded : null].filter(Boolean) as string[];
  const summaryLine = `${d.levels[difficulty]} · ${languageLabel} · ${fmt(d.setup.questions, { n: QUESTION_COUNT[length] })}`;

  const startButton = (
    <Button size="lg" className="w-full" disabled={!canStart} loading={busy} onClick={start}>
      {busy ? d.setup.starting : d.setup.start}
      {!busy && <ArrowRight className="size-4 rtl:-scale-x-100" />}
    </Button>
  );

  return (
    <div className="animate-fade-up">
      <PageHeader title={d.setup.title} />

      <div className="mt-8 grid gap-10 lg:grid-cols-[minmax(0,1fr)_280px] lg:gap-14">
        <div>
          <Section step={1} title={d.setup.stepTarget}>
            <Field label={d.setup.role}>
              {roles.error ? (
                <ErrorState onRetry={roles.reload} className="py-6" />
              ) : (
                <div role="radiogroup" aria-label={d.setup.role} className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {roles.loading || !roles.data
                    ? Array.from({ length: 8 }, (_, i) => <Skeleton key={i} className="h-11" />)
                    : roles.data.roles.map((r) => (
                        <button
                          key={r.id}
                          type="button"
                          role="radio"
                          aria-checked={roleId === r.id}
                          title={lang === "ar" ? r.descriptionAr : r.descriptionEn}
                          onClick={() => setRoleId(r.id)}
                          className={cn(
                            "min-h-11 rounded-lg border px-3 py-2 text-start text-sm leading-snug transition-colors outline-none focus-visible:ring-3 focus-visible:ring-primary/25",
                            roleId === r.id ? "border-primary bg-primary-soft/50 font-medium text-fg" : "border-border bg-surface text-fg hover:border-border-strong",
                          )}
                        >
                          {roleName(r)}
                        </button>
                      ))}
                </div>
              )}
            </Field>

            {jdOpen || jd ? (
              <Field label={d.setup.jd} optional={d.setup.optional} hint={d.setup.jdHint}>
                <Textarea value={jd} onChange={(e) => setJd(e.target.value.slice(0, JD_MAX))} placeholder={d.setup.jdPlaceholder} rows={4} dir="auto" aria-label={d.setup.jd} autoFocus={!jd} />
              </Field>
            ) : (
              <button type="button" onClick={() => setJdOpen(true)} className="inline-flex min-h-9 items-center gap-1.5 text-sm font-medium text-muted hover:text-fg">
                <Plus className="size-4" />
                {d.setup.jd}
                <span className="font-normal text-subtle">· {d.setup.optional}</span>
              </button>
            )}
          </Section>

          <Section step={2} title={d.setup.stepPersonalize}>
            <Field label={d.setup.cv} optional={d.setup.optional} hint={cv.status === "idle" ? d.setup.cvHint : undefined}>
              <CvUpload cv={cv} setCv={setCv} />
            </Field>
          </Section>

          <Section step={3} title={d.setup.stepPrefs}>
            <Field label={d.setup.language} hint={language === "smart" ? d.setup.smartHint : d.setup.languageHint}>
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
            </Field>
            <Field label={d.setup.difficulty} hint={d.levelHints[difficulty]}>
              <Segmented label={d.setup.difficulty} value={difficulty} onChange={setDifficulty} options={DIFFICULTIES.map((v) => ({ value: v, label: d.levels[v] }))} />
            </Field>
            <Field label={d.setup.length} hint={d.lengthHints[length]}>
              <Segmented label={d.setup.length} value={length} onChange={setLength} options={LENGTHS.map((v) => ({ value: v, label: d.lengths[v] }))} />
            </Field>
          </Section>
        </div>

        {/* Desktop: summary + start beside the form */}
        <aside className="hidden lg:sticky lg:top-24 lg:block lg:self-start">
          <div className="rounded-xl border border-border bg-surface p-5">
            <p className="font-medium">{role ? roleName(role) : <span className="text-subtle">{d.setup.chooseRole}</span>}</p>
            <p className="mt-1 text-sm text-muted">{summaryLine}</p>
            {extras.length > 0 && (
              <ul className="mt-3 space-y-1">
                {extras.map((x) => (
                  <li key={x} className="flex items-center gap-1.5 text-[13px] text-success">
                    <Check className="size-3.5" />
                    {x}
                  </li>
                ))}
              </ul>
            )}
            <div className="mt-5">{startButton}</div>
            <p className="t-caption mt-4 flex gap-2">
              <Mic className="mt-0.5 size-3.5 shrink-0" />
              {d.setup.micNote}
            </p>
          </div>
        </aside>
      </div>

      {/* Mobile/tablet: sticky start bar above the bottom navigation */}
      <div className="sticky bottom-[calc(3.5rem+env(safe-area-inset-bottom))] z-30 -mx-4 mt-2 border-t border-border bg-bg/95 px-4 py-3 backdrop-blur-sm sm:-mx-6 sm:px-6 md:bottom-0 lg:hidden">
        <div className="flex items-center gap-3">
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{role ? roleName(role) : <span className="text-subtle">{d.setup.chooseRole}</span>}</p>
            <p className="truncate text-xs text-muted">
              {summaryLine}
              {extras.length ? ` · ${extras.join(" · ")}` : ""}
            </p>
          </div>
          <div className="w-36 shrink-0 sm:w-44">{startButton}</div>
        </div>
      </div>
    </div>
  );
}
