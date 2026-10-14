import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Camera, Check, FileText, RotateCcw, Trash2, Upload, UploadCloud, X } from "lucide-react";
import { useSearchParams } from "react-router-dom";
import { CvReview } from "@/features/profile/CvReview";
import { TagEditor } from "@/features/profile/TagEditor";
import { useProfileCv } from "@/features/profile/useProfileCv";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { Avatar } from "@/components/ui/avatar";
import { Segmented } from "@/components/ui/segmented";
import { Spinner } from "@/components/ui/spinner";
import { Menu, MenuContent, MenuItem, MenuTrigger } from "@/components/ui/dropdown";
import { RoleCombobox, type RoleTarget } from "@/features/setup/RoleCombobox";
import { useFetch } from "@/hooks/useFetch";
import { api, ApiError, type CvProposal, type EducationItem, type ExperienceItem, type ExperienceLevel, type ProjectItem, type Role, type User } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/i18n";
import { AnimatePresence, m } from "@/lib/motion";
import { FieldRow, SettingsSection } from "@/components/layout/SettingsSection";

const LEVELS: ExperienceLevel[] = ["student", "graduate", "early", "experienced"];

/** Center-crops and resizes to a 256px square so a phone photo becomes a ~20 KB upload. */
async function toAvatarBlob(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const size = Math.min(bitmap.width, bitmap.height);
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 256;
  canvas.getContext("2d")!.drawImage(bitmap, (bitmap.width - size) / 2, (bitmap.height - size) / 2, size, size, 0, 0, 256, 256);
  bitmap.close();
  const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/webp", 0.86));
  return blob ?? new Promise<Blob>((r, j) => canvas.toBlob((b) => (b ? r(b) : j(new Error("encode"))), "image/jpeg", 0.86));
}

type Form = {
  name: string;
  headline: string;
  bio: string;
  currentRole: string;
  targetRole: string;
  specialization: string;
  experienceLevel: ExperienceLevel | null;
  skills: string[];
  certifications: string[];
  languages: string[];
  education: EducationItem[];
  experience: ExperienceItem[];
  projects: ProjectItem[];
};
const formFrom = (u: User): Form => ({
  name: u.name,
  headline: u.headline ?? "",
  bio: u.bio ?? "",
  currentRole: u.currentRole ?? "",
  targetRole: u.targetRole ?? "",
  specialization: u.specialization ?? "",
  experienceLevel: u.experienceLevel,
  skills: u.skills ?? [],
  certifications: u.certifications ?? [],
  languages: u.languages ?? [],
  education: u.education ?? [],
  experience: u.experience ?? [],
  projects: u.projects ?? [],
});

export default function Profile() {
  const { d, fmt, formatDate } = useI18n();
  const { user, setUser } = useAuth();
  const roles = useFetch(() => api.get<{ roles: Role[] }>("/roles"), []);
  const stats = useFetch(() => api.get<{ totalInterviews: number }>("/dashboard"), []);
  const [form, setForm] = useState<Form>(() => formFrom(user!));
  const [saving, setSaving] = useState(false);
  const [photoBusy, setPhotoBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // Re-sync after server-side changes (e.g. applying CV details), unless there are unsaved edits.
  const lastSaved = useRef(JSON.stringify(user ? formFrom(user) : null));
  useEffect(() => {
    if (!user) return;
    const fresh = JSON.stringify(formFrom(user));
    const previous = lastSaved.current;
    if (fresh !== previous) {
      // Only replace the form if it had no unsaved edits (it still equals the previous saved state).
      setForm((f) => (JSON.stringify(f) === previous ? formFrom(user) : f));
      lastSaved.current = fresh;
    }
  }, [user]);

  // Profile CV: upload → review dialog. "?review=1" (from the dashboard prompt) reopens the review.
  const cvApi = useProfileCv();
  const [review, setReview] = useState<{ proposal: CvProposal } | null>(null);
  const [params, setParams] = useSearchParams();
  useEffect(() => {
    if (params.get("review") !== "1") return;
    setParams({}, { replace: true });
    cvApi.loadReview().then((r) => r && setReview(r)).catch(() => {});
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const cvInput = useRef<HTMLInputElement>(null);
  const pickCv = async (f: File) => {
    const r = await cvApi.upload(f);
    if (r) setReview(r);
  };

  if (!user) return null;
  const saved = formFrom(user);
  const dirty = JSON.stringify(saved) !== JSON.stringify(form);
  const set = <K extends keyof Form>(k: K, v: Form[K]) => setForm((f) => ({ ...f, [k]: v }));
  const nameValid = form.name.trim().length >= 2;

  async function save() {
    if (!nameValid) return;
    setSaving(true);
    try {
      const res = await api.patch<{ user: User }>("/profile", form);
      setUser(res.user);
      setForm(formFrom(res.user));
      toast.success(d.profile.saved);
    } catch {
      toast.error(d.profile.saveFailed);
    } finally {
      setSaving(false);
    }
  }

  async function uploadPhoto(file: File) {
    if (!/^image\/(jpeg|png|webp)$/.test(file.type)) return toast.error(d.profile.photoError);
    setPhotoBusy(true);
    try {
      const form = new FormData();
      form.append("avatar", await toAvatarBlob(file), "avatar");
      setUser((await api.post<{ user: User }>("/profile/avatar", form)).user);
      toast.success(d.profile.photoSaved);
    } catch (err) {
      toast.error(err instanceof ApiError && err.code === "NETWORK_ERROR" ? d.room.errors.network : d.profile.photoError);
    } finally {
      setPhotoBusy(false);
    }
  }

  async function removePhoto() {
    setPhotoBusy(true);
    try {
      setUser((await api.del<{ user: User }>("/profile/avatar")).user);
      toast.success(d.profile.photoRemoved);
    } catch {
      toast.error(d.profile.saveFailed);
    } finally {
      setPhotoBusy(false);
    }
  }

  const target: RoleTarget | null = form.targetRole ? { roleId: roles.data?.roles.find((r) => r.nameEn === form.targetRole || r.nameAr === form.targetRole)?.id ?? null, title: form.targetRole } : null;
  const focusLine = [user.targetRole, user.specialization, user.experienceLevel ? d.profile.levels[user.experienceLevel] : null].filter(Boolean);

  return (
    <div className="mx-auto max-w-4xl pb-24">
      {/* Identity header */}
      <header className="relative overflow-hidden rounded-2xl border border-border bg-surface">
        <div className="dot-grid h-20 border-b border-border bg-bg-subtle sm:h-24" />
        <div className="px-5 pb-6 sm:px-8">
          <div className="relative -mt-12 w-fit max-sm:mx-auto sm:-mt-14">
            <Avatar user={user} className="size-24 border-4 border-surface text-3xl shadow-md sm:size-28" />
            <input
              ref={fileRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="sr-only"
              tabIndex={-1}
              aria-label={d.profile.uploadPhoto}
              onChange={(e) => {
                const f = e.target.files?.[0];
                e.target.value = "";
                if (f) uploadPhoto(f);
              }}
            />
            {user.avatarVersion ? (
              <Menu>
                <MenuTrigger asChild>
                  <button className="press absolute end-0 bottom-0 grid size-9 place-items-center rounded-full border-2 border-surface bg-ink text-ink-fg shadow-md outline-none focus-visible:ring-4 focus-visible:ring-primary/30" aria-label={d.profile.changePhoto}>
                    {photoBusy ? <Spinner className="size-4" /> : <Camera className="size-4" />}
                  </button>
                </MenuTrigger>
                <MenuContent align="start">
                  <MenuItem onSelect={() => fileRef.current?.click()}>
                    <Upload /> {d.profile.changePhoto}
                  </MenuItem>
                  <MenuItem onSelect={removePhoto} className="text-danger [&_svg]:text-danger">
                    <Trash2 /> {d.profile.removePhoto}
                  </MenuItem>
                </MenuContent>
              </Menu>
            ) : (
              <button
                onClick={() => fileRef.current?.click()}
                className="press absolute end-0 bottom-0 grid size-9 place-items-center rounded-full border-2 border-surface bg-ink text-ink-fg shadow-md outline-none focus-visible:ring-4 focus-visible:ring-primary/30"
                aria-label={d.profile.uploadPhoto}
              >
                {photoBusy ? <Spinner className="size-4" /> : <Camera className="size-4" />}
              </button>
            )}
          </div>
          <div className="mt-4 flex flex-col gap-4 text-center sm:flex-row sm:items-end sm:justify-between sm:text-start">
          <div className="min-w-0 flex-1">
            <h1 className="t-page break-words [unicode-bidi:plaintext] max-sm:text-center sm:text-left sm:rtl:text-right">
              {user.name}
            </h1>
            <p className="mt-1 text-[15px] text-muted [unicode-bidi:plaintext] max-sm:text-center sm:text-left sm:rtl:text-right">
              {user.headline || <span className="text-subtle">{d.profile.addHeadline}</span>}
            </p>
            {focusLine.length > 0 && (
              <div className="mt-3 flex flex-wrap justify-center gap-1.5 sm:justify-start">
                {focusLine.map((x) => (
                  <span key={x} className="rounded-full bg-primary-soft px-2.5 py-1 text-[12.5px] font-medium text-primary-soft-fg" dir="auto">
                    {x}
                  </span>
                ))}
              </div>
            )}
          </div>
          <div className="shrink-0 text-[13px] text-subtle sm:text-end">
            <p>{fmt(d.profile.memberSince, { date: formatDate(user.createdAt) })}</p>
            {stats.data && <p className="mt-0.5 font-medium text-muted">{fmt(d.profile.interviewsDone, { n: stats.data.totalInterviews })}</p>}
          </div>
          </div>
        </div>
      </header>

      <div className="mt-10">
        <SettingsSection title={d.profileCv.title} hint={d.profileCv.hint}>
          <input
            ref={cvInput}
            type="file"
            accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            className="sr-only"
            tabIndex={-1}
            aria-label={d.profileCv.upload}
            onChange={(e) => {
              const f = e.target.files?.[0];
              e.target.value = "";
              if (f) pickCv(f);
            }}
          />
          {cvApi.busy === "upload" || cvApi.busy === "retry" ? (
            <div className="flex items-center gap-3 rounded-xl border border-border bg-surface px-4 py-4">
              <Spinner className="size-4" />
              <span className="text-sm text-muted">{d.profileCv.reading}</span>
            </div>
          ) : user.cv ? (
            <div className={cn("rounded-xl border bg-surface px-4 py-3.5", user.cv.status === "failed" ? "border-danger/30" : "border-success/30")}>
              <div className="flex items-center gap-3">
                <span className={cn("grid size-10 shrink-0 place-items-center rounded-lg", user.cv.status === "failed" ? "bg-danger-soft text-danger" : "bg-success-soft text-success")}>
                  <FileText className="size-5" strokeWidth={1.75} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium" dir="auto" title={user.cv.fileName}>
                    {user.cv.fileName}
                  </p>
                  <p className={cn("mt-0.5 text-xs", user.cv.status === "failed" ? "text-danger" : "text-subtle")}>
                    {user.cv.status === "failed" ? d.profileCv.failed : `${d.profileCv.ready} · ${fmt(d.profileCv.updated, { date: formatDate(user.cv.updatedAt) })}`}
                  </p>
                </div>
              </div>
              <div className="-ms-2 mt-2 flex flex-wrap gap-1">
                {user.cv.status === "failed" ? (
                  <Button variant="ghost" size="sm" onClick={async () => { const r = await cvApi.retry(); if (r) setReview(r); }}>
                    <RotateCcw className="size-3.5" />
                    {d.profileCv.retry}
                  </Button>
                ) : (
                  <Button variant="ghost" size="sm" onClick={async () => { const r = await cvApi.loadReview().catch(() => null); if (r) setReview(r); }}>
                    {d.profileCv.review}
                  </Button>
                )}
                <Button variant="ghost" size="sm" onClick={() => cvInput.current?.click()}>
                  {d.profileCv.replace}
                </Button>
                <Button variant="ghost" size="sm" className="text-danger hover:bg-danger-soft hover:text-danger" loading={cvApi.busy === "remove"} onClick={cvApi.remove}>
                  {d.profileCv.remove}
                </Button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => cvInput.current?.click()}
              className="flex w-full items-center gap-3 rounded-xl border border-dashed border-border-strong bg-surface px-4 py-4 text-start transition-colors outline-none hover:border-primary/50 hover:bg-primary-soft/20 focus-visible:ring-3 focus-visible:ring-primary/25"
            >
              <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-surface-2 text-muted">
                <UploadCloud className="size-5" strokeWidth={1.75} />
              </span>
              <span>
                <span className="block text-sm font-medium">{d.profileCv.upload}</span>
                <span className="t-caption">{d.profileCv.types}</span>
              </span>
            </button>
          )}
        </SettingsSection>

        <SettingsSection title={d.profile.about}>
          <FieldRow label={d.profile.name} htmlFor="p-name">
            <Input id="p-name" value={form.name} maxLength={80} onChange={(e) => set("name", e.target.value)} autoComplete="name" dir="auto" aria-invalid={!nameValid} />
          </FieldRow>
          <FieldRow label={d.profile.headline} htmlFor="p-headline">
            <Input id="p-headline" value={form.headline} maxLength={120} onChange={(e) => set("headline", e.target.value)} placeholder={d.profile.headlinePh} dir="auto" />
          </FieldRow>
          <FieldRow label={d.profile.bio} htmlFor="p-bio">
            <Textarea id="p-bio" value={form.bio} maxLength={400} rows={3} onChange={(e) => set("bio", e.target.value)} placeholder={d.profile.bioPh} dir="auto" className="min-h-24" />
            <p className="t-caption mt-1 text-end tabular-nums">{form.bio.length} / 400</p>
          </FieldRow>
        </SettingsSection>

        <SettingsSection title={d.profile.focus} hint={d.profile.focusHint}>
          <FieldRow label={d.background.currentRole} htmlFor="p-current">
            <Input id="p-current" value={form.currentRole} maxLength={80} onChange={(e) => set("currentRole", e.target.value)} dir="auto" />
          </FieldRow>
          <FieldRow label={d.profile.targetRole}>
            <RoleCombobox roles={roles.data?.roles ?? []} loading={roles.loading} value={target} onChange={(v) => set("targetRole", v?.title ?? "")} />
          </FieldRow>
          <FieldRow label={d.profile.specialization} htmlFor="p-spec">
            <Input id="p-spec" value={form.specialization} maxLength={80} onChange={(e) => set("specialization", e.target.value)} placeholder={d.profile.specializationPh} dir="auto" />
          </FieldRow>
          <FieldRow label={d.profile.experience}>
            <Segmented
              id="exp"
              label={d.profile.experience}
              value={form.experienceLevel ?? ("" as ExperienceLevel)}
              onChange={(v) => set("experienceLevel", v)}
              options={LEVELS.map((l) => ({ value: l, label: d.profile.levels[l] }))}
              className="max-sm:grid-flow-row max-sm:grid-cols-2"
            />
          </FieldRow>
        </SettingsSection>

        <SettingsSection title={d.background.title} hint={d.background.hint}>
          <FieldRow label={d.background.skills}>
            <TagEditor items={form.skills} onChange={(v) => set("skills", v)} addLabel={d.background.addSkill} removeLabel={d.background.removeItem} />
          </FieldRow>
          {(["experience", "education", "projects"] as const).map((k) =>
            form[k].length ? (
              <FieldRow key={k} label={d.background[k]}>
                <ul className="divide-y divide-border rounded-xl border border-border bg-surface">
                  {form[k].map((x, i) => {
                    const title = k === "education" ? [(x as EducationItem).degree, (x as EducationItem).field].filter(Boolean).join(" · ") : k === "experience" ? ((x as ExperienceItem).title ?? (x as ExperienceItem).organization) : (x as ProjectItem).name;
                    const sub = k === "education" ? [(x as EducationItem).institution, (x as EducationItem).years].filter(Boolean).join(" · ") : k === "experience" ? [(x as ExperienceItem).organization, (x as ExperienceItem).period].filter(Boolean).join(" · ") : (x as ProjectItem).summary;
                    return (
                      <li key={i} className="flex items-start gap-3 px-3.5 py-2.5">
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium break-words" dir="auto">{title}</p>
                          {sub && <p className="t-caption break-words" dir="auto">{sub}</p>}
                        </div>
                        <button type="button" onClick={() => set(k, form[k].filter((_, j) => j !== i) as never)} aria-label={`${d.background.removeItem}: ${title}`} className="grid size-7 shrink-0 place-items-center rounded-md text-subtle hover:bg-surface-2 hover:text-danger">
                          <X className="size-3.5" />
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </FieldRow>
            ) : null,
          )}
          {(["certifications", "languages"] as const).map((k) =>
            form[k].length ? (
              <FieldRow key={k} label={d.background[k]}>
                <TagEditor items={form[k]} onChange={(v) => set(k, v)} removeLabel={d.background.removeItem} />
              </FieldRow>
            ) : null,
          )}
        </SettingsSection>
      </div>

      {review && <CvReview proposal={review.proposal} open onClose={() => setReview(null)} />}

      {/* Save bar: only when something changed */}
      <AnimatePresence>
        {dirty && (
          <m.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 16 }}
            className="fixed inset-x-0 bottom-[calc(4rem+env(safe-area-inset-bottom))] z-30 px-4 md:bottom-6"
          >
            <div className="mx-auto flex max-w-xl items-center gap-3 rounded-2xl border border-border bg-surface/95 p-2.5 ps-4 shadow-lg backdrop-blur-md">
              <p className="min-w-0 flex-1 truncate text-sm font-medium">{d.profile.unsaved}</p>
              <Button variant="ghost" size="sm" onClick={() => setForm(saved)} disabled={saving}>
                {d.profile.discard}
              </Button>
              <Button size="sm" onClick={save} loading={saving} disabled={!nameValid}>
                {!saving && <Check className="size-4" />}
                {d.profile.save}
              </Button>
            </div>
          </m.div>
        )}
      </AnimatePresence>
    </div>
  );
}
