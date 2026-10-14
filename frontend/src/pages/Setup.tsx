import { useEffect, useRef, useState, type ReactNode } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { ArrowRight, Briefcase, Check, FileText, Mic, Plus, UploadCloud, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { ErrorState } from "@/components/ui/states";
import { PageHeader } from "@/components/layout/PageHeader";
import { RoleCombobox, type RoleTarget } from "@/features/setup/RoleCombobox";
import { Segmented } from "@/components/ui/segmented";
import { useFetch } from "@/hooks/useFetch";
import { api, ApiError, type Difficulty, type InterviewDTO, type Length, type Role } from "@/lib/api";
import { useI18n, type Lang } from "@/i18n";
import { useAuth } from "@/lib/auth";
import { usePreferences } from "@/lib/preferences";
import { AnimatePresence, m } from "@/lib/motion";
import { cn } from "@/lib/utils";

const DIFFICULTIES: Difficulty[] = ["beginner", "intermediate", "advanced"];
const LENGTHS: Length[] = ["quick", "standard", "full"];
const QUESTION_COUNT: Record<Length, number> = { quick: 4, standard: 6, full: 10 };
const JD_MAX = 2500;
const CV_MAX = 5 * 1024 * 1024;
const TEACHING = /teach|tutor|instructor|lecturer|kindergarten|معلم|مدرس|معيد|تدريس|رياض أطفال/i;

function Section({ step, title, children }: { step: number; title: string; children: ReactNode }) {
  return (
    <section className="border-t border-border py-7 first:border-t-0 first:pt-0">
      <h2 className="t-section mb-4 flex items-center gap-2.5">
        <span className="grid size-5 place-items-center rounded-full bg-ink text-[11px] font-semibold text-ink-fg tabular-nums">{step}</span>
        {title}
      </h2>
      <div className="space-y-5">{children}</div>
    </section>
  );
}

function Field({ label, optional, hint, children, htmlFor }: { label: string; optional?: string; hint?: string; children: ReactNode; htmlFor?: string }) {
  return (
    <div>
      <label htmlFor={htmlFor} className="mb-2 flex items-baseline gap-2">
        <span className="t-label">{label}</span>
        {optional && <span className="t-caption">· {optional}</span>}
      </label>
      {children}
      {hint && <p className="t-caption mt-2">{hint}</p>}
    </div>
  );
}

type CvState = { status: "idle" } | { status: "reading"; name: string } | { status: "ready"; name: string; profile: string } | { status: "error"; message: string };

/** Optional CV: drop or browse → server reads it → only a short profile is kept for the interview. */
function CvUpload({ cv, setCv }: { cv: CvState; setCv: (c: CvState) => void }) {
  const { d } = useI18n();
  const input = useRef<HTMLInputElement>(null);
  const [drag, setDrag] = useState(false);

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
      tabIndex={-1}
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
      <div className={cn("flex h-full min-h-[5.5rem] items-center gap-3 rounded-xl border bg-surface px-4 py-3", cv.status === "ready" ? "border-success/30" : "border-border")}>
        <span className={cn("grid size-10 shrink-0 place-items-center rounded-lg", cv.status === "ready" ? "bg-success-soft text-success" : "bg-surface-2 text-muted")}>
          {cv.status === "ready" ? <FileText className="size-5" strokeWidth={1.75} /> : <Spinner className="size-4" />}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium" dir="auto" title={cv.name}>
            {cv.name}
          </p>
          <p className={cn("mt-0.5 flex items-center gap-1.5 text-xs", cv.status === "ready" ? "text-success" : "text-muted")}>
            {cv.status === "ready" && <Check className="size-3.5" />}
            {cv.status === "ready" ? d.setup.cvReady : d.setup.cvReading}
          </p>
          {cv.status === "ready" && (
            <div className="-ms-2 mt-1 flex gap-1">
              <Button variant="ghost" size="sm" className="h-7 px-2" onClick={() => input.current?.click()}>
                {d.setup.cvReplace}
              </Button>
              <Button variant="ghost" size="sm" className="h-7 px-2 text-danger hover:bg-danger-soft hover:text-danger" onClick={() => setCv({ status: "idle" })}>
                {d.setup.cvRemove}
              </Button>
            </div>
          )}
        </div>
        {picker}
      </div>
    );

  return (
    <div className="h-full">
      <button
        type="button"
        onClick={() => input.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setDrag(true);
        }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDrag(false);
          const f = e.dataTransfer.files?.[0];
          if (f) upload(f);
        }}
        className={cn(
          "flex h-full min-h-[5.5rem] w-full items-center gap-3 rounded-xl border border-dashed px-4 py-3 text-start transition-all outline-none focus-visible:ring-3 focus-visible:ring-primary/25",
          drag ? "scale-[1.01] border-primary bg-primary-soft/50" : "border-border-strong bg-surface hover:border-primary/50 hover:bg-primary-soft/20",
        )}
      >
        <span className={cn("grid size-10 shrink-0 place-items-center rounded-lg transition-colors", drag ? "bg-primary text-primary-fg" : "bg-surface-2 text-muted")}>
          <UploadCloud className="size-5" strokeWidth={1.75} />
        </span>
        <span className="min-w-0">
          <span className="block text-sm font-medium">{d.setup.cvDrop}</span>
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

  // Defaults: "Practice again" link > profile (target role, specialization) > settings (interview defaults).
  const { user } = useAuth();
  const { prefs } = usePreferences();
  const fromLink = params.has("role") || params.has("roleTitle");
  const [target, setTarget] = useState<RoleTarget | null>(() => {
    const title = params.get("roleTitle") ?? (fromLink ? null : user?.targetRole);
    return title ? { roleId: null, title } : null;
  });
  const [specialization, setSpecialization] = useState(params.get("spec") ?? (fromLink ? "" : (user?.specialization ?? "")));
  // "smart" = bilingual: starts in the UI language, then the interviewer follows the student.
  const [language, setLanguage] = useState<Lang | "smart">((params.get("mode") === "smart" ? "smart" : (params.get("lang") as Lang)) || prefs.interviewLanguage || lang);
  const [difficulty, setDifficulty] = useState<Difficulty>((params.get("difficulty") as Difficulty) || prefs.difficulty || "beginner");
  const [length, setLength] = useState<Length>((params.get("length") as Length) || prefs.length || "quick");
  const [jdOpen, setJdOpen] = useState(false);
  const [jd, setJd] = useState("");
  const [cv, setCv] = useState<CvState>({ status: "idle" });
  const [useProfileCv, setUseProfileCv] = useState(true);
  const [busy, setBusy] = useState(false);

  // Once suggestions load: preselect a "Practice again" role, or link a profile target role to its suggestion.
  const presetRole = params.get("role");
  useEffect(() => {
    const list = roles.data?.roles ?? [];
    const byId = list.find((x) => x.id === presetRole);
    const byName = target && !target.roleId ? list.find((x) => x.nameEn.toLowerCase() === target.title.toLowerCase() || x.nameAr === target.title) : undefined;
    const r = byId ?? byName;
    if (r && (!target || !target.roleId)) setTarget({ roleId: r.id, title: lang === "ar" ? r.nameAr : r.nameEn });
  }, [roles.data]); // eslint-disable-line react-hooks/exhaustive-deps

  const selectedRole = roles.data?.roles.find((r) => r.id === target?.roleId);
  const teaching = selectedRole ? (selectedRole.domain ?? "education") === "education" : TEACHING.test(target?.title ?? "");
  const canStart = Boolean(target?.title) && cv.status !== "reading" && !busy;

  async function start() {
    if (!target) return;
    setBusy(true);
    try {
      const { interview } = await api.post<{ interview: InterviewDTO }>("/interviews", {
        ...(target.roleId ? { roleId: target.roleId } : { roleTitle: target.title }),
        specialization: specialization.trim() || null,
        language: language === "smart" ? lang : language,
        languageMode: language === "smart" ? "smart" : "fixed",
        difficulty,
        length,
        jobDescription: jd.trim() || null,
        cvProfile: cv.status === "ready" ? cv.profile : null,
        // An interview-specific CV wins; otherwise the server uses the profile CV if the student kept it on.
        useProfileCv: useProfileCv && cv.status !== "ready",
      });
      navigate(`/interviews/${interview.id}`, { state: { autoStart: true } });
    } catch (err) {
      const msg = err instanceof ApiError && err.code === "NETWORK_ERROR" ? d.room.errors.network : err instanceof ApiError && err.code === "AI_FAILED" ? d.setup.startFailed : d.room.errors.generic;
      toast.error(msg, { action: { label: d.common.retry, onClick: start } });
      setBusy(false);
    }
  }

  const languageLabel = language === "smart" ? d.setup.smart : d.langs[language];
  const profileCvOn = Boolean(user?.cv && user.cv.status === "ready" && useProfileCv && cv.status === "idle");
  const extras = [cv.status === "ready" || profileCvOn ? d.setup.cvAdded : null, jd.trim() ? d.setup.jdAdded : null].filter(Boolean) as string[];
  const summaryLine = `${d.levels[difficulty]} · ${languageLabel} · ${fmt(d.setup.questions, { n: QUESTION_COUNT[length] })}`;

  const startButton = (
    <Button size="lg" className="w-full" disabled={!canStart} loading={busy} onClick={start}>
      {busy ? d.setup.starting : d.setup.start}
      {!busy && <ArrowRight className="size-4 rtl:-scale-x-100" />}
    </Button>
  );

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader title={d.setup.title} description={d.setup.subtitle} />

      <div className="mt-8 grid grid-cols-[minmax(0,1fr)] gap-10 lg:grid-cols-[minmax(0,1fr)_300px] lg:gap-12">
        <div>
          <Section step={1} title={d.setup.stepTarget}>
            <Field label={d.setup.role} hint={target ? undefined : d.setup.roleHint}>
              {roles.error ? <ErrorState onRetry={roles.reload} className="py-6" /> : <RoleCombobox roles={roles.data?.roles ?? []} loading={roles.loading} value={target} onChange={setTarget} />}
            </Field>
            <Field label={d.setup.specialization} optional={d.setup.optional} hint={d.setup.specializationHint} htmlFor="specialization">
              <Input
                id="specialization"
                value={specialization}
                onChange={(e) => setSpecialization(e.target.value.slice(0, 80))}
                placeholder={teaching ? d.setup.specializationEdu : d.setup.specializationOther}
                dir="auto"
                autoComplete="off"
                className="h-11 rounded-xl text-base sm:text-sm"
              />
            </Field>
          </Section>

          <Section step={2} title={d.setup.stepPersonalize}>
            <div className="grid gap-3 sm:grid-cols-2">
              {profileCvOn ? (
                <div className="flex h-full min-h-[5.5rem] flex-col justify-center rounded-xl border border-success/30 bg-surface px-4 py-3">
                  <div className="flex items-center gap-3">
                    <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-success-soft text-success">
                      <FileText className="size-5" strokeWidth={1.75} />
                    </span>
                    <div className="min-w-0">
                      <p className="flex items-center gap-1.5 text-sm font-medium">
                        <Check className="size-3.5 text-success" />
                        {d.profileCv.setupUsing}
                      </p>
                      <p className="t-caption truncate" dir="auto">
                        {user!.cv!.fileName}
                      </p>
                    </div>
                  </div>
                  <div className="-ms-2 mt-1.5 flex flex-wrap gap-1">
                    <Button variant="ghost" size="sm" className="h-7 px-2" onClick={() => setUseProfileCv(false)}>
                      {d.profileCv.setupDifferent}
                    </Button>
                    <Button variant="ghost" size="sm" className="h-7 px-2 text-muted" onClick={() => setUseProfileCv(false)}>
                      {d.profileCv.setupSkip}
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="h-full">
                  <CvUpload cv={cv} setCv={setCv} />
                  {user?.cv?.status === "ready" && !useProfileCv && cv.status === "idle" && (
                    <button type="button" onClick={() => setUseProfileCv(true)} className="mt-2 text-[13px] font-medium text-primary hover:underline">
                      {d.profileCv.setupUseProfile}
                    </button>
                  )}
                </div>
              )}
              {!(jdOpen || jd) && (
                <button
                  type="button"
                  onClick={() => setJdOpen(true)}
                  className="flex min-h-[5.5rem] w-full items-center gap-3 rounded-xl border border-dashed border-border-strong bg-surface px-4 py-3 text-start transition-all outline-none hover:border-primary/50 hover:bg-primary-soft/20 focus-visible:ring-3 focus-visible:ring-primary/25"
                >
                  <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-surface-2 text-muted">
                    <Briefcase className="size-5" strokeWidth={1.75} />
                  </span>
                  <span className="min-w-0">
                    <span className="flex items-center gap-1 text-sm font-medium">
                      <Plus className="size-3.5" />
                      {d.setup.jdAdd}
                    </span>
                    <span className="t-caption">{d.setup.jdHint}</span>
                  </span>
                </button>
              )}
            </div>
            <AnimatePresence initial={false}>
              {(jdOpen || jd) && (
                <m.div key="jd" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
                  <div className="mb-2 flex items-center justify-between">
                    <label htmlFor="jd" className="flex items-baseline gap-2">
                      <span className="t-label">{d.setup.jd}</span>
                      <span className="t-caption">· {d.setup.optional}</span>
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        setJd("");
                        setJdOpen(false);
                      }}
                      className="inline-flex items-center gap-1 rounded-md px-1.5 py-1 text-xs text-muted hover:bg-surface-2 hover:text-fg"
                    >
                      <X className="size-3.5" />
                      {d.setup.jdRemove}
                    </button>
                  </div>
                  <Textarea id="jd" value={jd} onChange={(e) => setJd(e.target.value.slice(0, JD_MAX))} placeholder={d.setup.jdPlaceholder} rows={5} dir="auto" autoFocus={!jd} className="rounded-xl" />
                  <p className="t-caption mt-1.5 text-end tabular-nums">
                    {jd.length} / {JD_MAX}
                  </p>
                </m.div>
              )}
            </AnimatePresence>
          </Section>

          <Section step={3} title={d.setup.stepPrefs}>
            <Field label={d.setup.language} hint={language === "smart" ? d.setup.smartHint : d.setup.languageHint}>
              <Segmented
                id="lang"
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
              <Segmented id="difficulty" label={d.setup.difficulty} value={difficulty} onChange={setDifficulty} options={DIFFICULTIES.map((v) => ({ value: v, label: d.levels[v] }))} />
            </Field>
            <Field label={d.setup.length} hint={d.lengthHints[length]}>
              <Segmented id="length" label={d.setup.length} value={length} onChange={setLength} options={LENGTHS.map((v) => ({ value: v, label: d.lengths[v] }))} />
            </Field>
          </Section>
        </div>

        {/* Desktop: live summary + start */}
        <aside className="hidden lg:sticky lg:top-24 lg:block lg:self-start">
          <div className="overflow-hidden rounded-2xl border border-border bg-surface shadow-sm">
            <div className="dot-grid border-b border-border px-5 pt-5 pb-4">
              <p className="t-eyebrow">{d.setup.summary}</p>
              <AnimatePresence mode="wait" initial={false}>
                <m.p key={target?.title ?? "none"} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.15 }} className="mt-2 text-lg leading-snug font-semibold tracking-[-0.02em] break-words" dir="auto">
                  {target?.title || <span className="font-normal text-subtle">{d.setup.chooseRole}</span>}
                </m.p>
              </AnimatePresence>
              {specialization.trim() && (
                <p className="mt-0.5 truncate text-sm text-muted" dir="auto">
                  {specialization.trim()}
                </p>
              )}
            </div>
            <div className="px-5 py-4">
              <p className="text-sm text-muted">{summaryLine}</p>
              {extras.length > 0 && (
                <ul className="mt-3 space-y-1.5">
                  {extras.map((x) => (
                    <li key={x} className="flex animate-pop-in items-center gap-1.5 text-[13px] font-medium text-success">
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
          </div>
        </aside>
      </div>

      {/* Mobile/tablet: sticky start bar above the bottom navigation */}
      <div className="sticky bottom-[calc(4rem+env(safe-area-inset-bottom))] z-30 -mx-4 mt-2 border-t border-border bg-bg/90 px-4 py-3 backdrop-blur-md sm:-mx-6 sm:px-6 md:bottom-0 lg:hidden">
        <div className="flex items-center gap-3">
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold" dir="auto">
              {target?.title || <span className="font-normal text-subtle">{d.setup.chooseRole}</span>}
            </p>
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
