import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { FileText, LogOut, Mic } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Segmented } from "@/components/ui/segmented";
import { Switch } from "@/components/ui/switch";
import { PageHeader } from "@/components/layout/PageHeader";
import { FieldRow, SettingsSection } from "@/components/layout/SettingsSection";
import { api, ApiError, type Difficulty, type Length } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { usePreferences } from "@/lib/preferences";
import { useTheme, type ThemePref } from "@/lib/theme";
import { useI18n, type Lang } from "@/i18n";

function ToggleRow({ id, label, hint, checked, onChange }: { id: string; label: string; hint: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-start justify-between gap-6">
      <label htmlFor={id} className="min-w-0 cursor-pointer">
        <span className="block text-sm font-medium">{label}</span>
        <span className="t-caption mt-0.5 block">{hint}</span>
      </label>
      <Switch id={id} label={label} checked={checked} onChange={onChange} />
    </div>
  );
}

function PasswordForm() {
  const { d } = useI18n();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (next.length < 8) return setError(d.auth.errors.passwordShort);
    setBusy(true);
    try {
      await api.post("/profile/password", { current, next });
      setCurrent("");
      setNext("");
      toast.success(d.settings.passwordUpdated);
    } catch (err) {
      setError(err instanceof ApiError && err.code === "WRONG_PASSWORD" ? d.settings.wrongPassword : d.settings.saveFailed);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-3" noValidate>
      <p className="text-sm font-medium">{d.settings.password}</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <Input type="password" autoComplete="current-password" dir="ltr" value={current} onChange={(e) => setCurrent(e.target.value)} placeholder={d.settings.currentPassword} aria-label={d.settings.currentPassword} />
        <Input type="password" autoComplete="new-password" dir="ltr" value={next} onChange={(e) => setNext(e.target.value)} placeholder={d.settings.newPassword} aria-label={d.settings.newPassword} />
      </div>
      {error && (
        <p className="text-[13px] text-danger" role="alert">
          {error}
        </p>
      )}
      <Button type="submit" variant="secondary" size="sm" loading={busy} disabled={!current || !next}>
        {d.settings.updatePassword}
      </Button>
    </form>
  );
}

export default function Settings() {
  const { d, lang, setLang } = useI18n();
  const { theme, setTheme } = useTheme();
  const { prefs, save } = usePreferences();
  const { user, logout } = useAuth();

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader title={d.settings.title} description={d.settings.subtitle} />
      <div className="mt-10">
        <SettingsSection title={d.settings.appearance}>
          <FieldRow label={d.settings.theme}>
            <Segmented<ThemePref>
              id="theme"
              label={d.settings.theme}
              value={theme}
              onChange={(v) => {
                setTheme(v);
                save({ theme: v });
              }}
              options={[
                { value: "light", label: d.common.light },
                { value: "dark", label: d.common.dark },
                { value: "system", label: d.common.system },
              ]}
            />
          </FieldRow>
          <FieldRow label={d.settings.language} hint={d.settings.languageHint}>
            <Segmented<Lang>
              id="ui-lang"
              label={d.settings.language}
              value={lang}
              onChange={(v) => {
                setLang(v);
                save({ uiLanguage: v });
              }}
              options={[
                { value: "ar", label: "العربية" },
                { value: "en", label: "English" },
              ]}
            />
          </FieldRow>
        </SettingsSection>

        <SettingsSection title={d.settings.defaults} hint={d.settings.defaultsHint}>
          <FieldRow label={d.setup.language}>
            <Segmented<"ar" | "en" | "smart">
              id="def-lang"
              label={d.setup.language}
              value={prefs.interviewLanguage ?? lang}
              onChange={(v) => save({ interviewLanguage: v })}
              options={[
                { value: "ar", label: "العربية" },
                { value: "en", label: "English" },
                { value: "smart", label: d.setup.smart },
              ]}
            />
          </FieldRow>
          <FieldRow label={d.setup.difficulty}>
            <Segmented<Difficulty>
              id="def-diff"
              label={d.setup.difficulty}
              value={prefs.difficulty ?? "beginner"}
              onChange={(v) => save({ difficulty: v })}
              options={(["beginner", "intermediate", "advanced"] as const).map((v) => ({ value: v, label: d.levels[v] }))}
            />
          </FieldRow>
          <FieldRow label={d.setup.length} hint={d.lengthHints[prefs.length ?? "quick"]}>
            <Segmented<Length>
              id="def-len"
              label={d.setup.length}
              value={prefs.length ?? "quick"}
              onChange={(v) => save({ length: v })}
              options={(["quick", "standard", "full"] as const).map((v) => ({ value: v, label: d.lengths[v] }))}
            />
          </FieldRow>
        </SettingsSection>

        <SettingsSection title={d.settings.voice}>
          <ToggleRow id="autoplay" label={d.settings.autoPlay} hint={d.settings.autoPlayHint} checked={prefs.autoPlayVoice} onChange={(v) => save({ autoPlayVoice: v })} />
          <ToggleRow id="captions" label={d.settings.captions} hint={d.settings.captionsHint} checked={prefs.captions} onChange={(v) => save({ captions: v })} />
          <ToggleRow id="motion" label={d.settings.reduceMotion} hint={d.settings.reduceMotionHint} checked={prefs.reducedMotion === "reduce"} onChange={(v) => save({ reducedMotion: v ? "reduce" : "system" })} />
        </SettingsSection>

        <SettingsSection title={d.settings.privacy}>
          <ul className="space-y-2.5 text-sm text-muted">
            <li className="flex gap-2.5">
              <Mic className="mt-0.5 size-4 shrink-0 text-subtle" />
              {d.settings.privacyAudio}
            </li>
            <li className="flex gap-2.5">
              <FileText className="mt-0.5 size-4 shrink-0 text-subtle" />
              {d.settings.privacyCv}
            </li>
          </ul>
          <div className="border-t border-border pt-5">
            <p className="t-label">{d.settings.email}</p>
            <p className="mt-1 text-sm font-medium" dir="ltr">
              {user?.email}
            </p>
          </div>
          <div className="border-t border-border pt-5">
            <PasswordForm />
          </div>
          <div className="border-t border-border pt-5">
            <Button variant="ghost" size="sm" className="-ms-2 text-danger hover:bg-danger-soft hover:text-danger" onClick={() => logout()}>
              <LogOut className="size-4 rtl:-scale-x-100" />
              {d.common.logout}
            </Button>
          </div>
        </SettingsSection>
      </div>
    </div>
  );
}
