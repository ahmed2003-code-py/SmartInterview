import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Camera, Check, Trash2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { Avatar } from "@/components/ui/avatar";
import { Segmented } from "@/components/ui/segmented";
import { Spinner } from "@/components/ui/spinner";
import { Menu, MenuContent, MenuItem, MenuTrigger } from "@/components/ui/dropdown";
import { RoleCombobox, type RoleTarget } from "@/features/setup/RoleCombobox";
import { useFetch } from "@/hooks/useFetch";
import { api, ApiError, type ExperienceLevel, type Role, type User } from "@/lib/api";
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

type Form = { name: string; headline: string; bio: string; targetRole: string; specialization: string; experienceLevel: ExperienceLevel | null };
const formFrom = (u: User): Form => ({
  name: u.name,
  headline: u.headline ?? "",
  bio: u.bio ?? "",
  targetRole: u.targetRole ?? "",
  specialization: u.specialization ?? "",
  experienceLevel: u.experienceLevel,
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

  useEffect(() => {
    if (user) setForm(formFrom(user));
  }, [user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!user) return null;
  const saved = formFrom(user);
  const dirty = JSON.stringify(saved) !== JSON.stringify(form);
  const set = <K extends keyof Form>(k: K, v: Form[K]) => setForm((f) => ({ ...f, [k]: v }));
  const nameValid = form.name.trim().length >= 2;

  async function save() {
    if (!nameValid) return;
    setSaving(true);
    try {
      const res = await api.patch<{ user: User }>("/profile", {
        name: form.name,
        headline: form.headline,
        bio: form.bio,
        targetRole: form.targetRole,
        specialization: form.specialization,
        experienceLevel: form.experienceLevel,
      });
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
            <h1 className="t-page break-words" dir="auto">
              {user.name}
            </h1>
            <p className="mt-1 text-[15px] text-muted" dir="auto">
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
      </div>

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
