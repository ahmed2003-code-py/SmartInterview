import { createContext, useCallback, useContext, useEffect, useRef, type ReactNode } from "react";
import { toast } from "sonner";
import { api, type Preferences, type User } from "./api";
import { useAuth } from "./auth";
import { useTheme } from "./theme";
import { useI18n } from "@/i18n";

/** Defaults for preferences a user never changed. */
const DEFAULTS: Required<Pick<Preferences, "autoPlayVoice" | "captions" | "reducedMotion">> = { autoPlayVoice: true, captions: true, reducedMotion: "system" };

type Prefs = Preferences & typeof DEFAULTS;
const Ctx = createContext<{ prefs: Prefs; save: (patch: Preferences, opts?: { silent?: boolean }) => Promise<void> } | null>(null);

/**
 * Account preferences, stored on the server so they follow the user to any device.
 * Theme and UI language are also kept on the device (they apply before sign-in); once signed in,
 * the account's values win and later changes (including the header toggles) are saved to the account.
 */
export function PreferencesProvider({ children }: { children: ReactNode }) {
  const { user, setUser } = useAuth();
  const { theme, setTheme } = useTheme();
  const { lang, setLang, d } = useI18n();
  const applied = useRef<string | null>(null);
  const prefs = { ...DEFAULTS, ...(user?.preferences ?? {}) } as Prefs;

  const save = useCallback(
    async (patch: Preferences, { silent = false } = {}) => {
      let previous: User | null = null;
      setUser((u) => {
        previous = u;
        return u ? { ...u, preferences: { ...u.preferences, ...patch } } : u;
      });
      try {
        const res = await api.patch<{ user: User }>("/profile/preferences", patch);
        setUser(res.user);
        if (!silent) toast.success(d.settings.saved, { id: "prefs" });
      } catch {
        if (previous) setUser(previous);
        toast.error(d.settings.saveFailed, { id: "prefs" });
      }
    },
    [setUser, d.settings.saved, d.settings.saveFailed],
  );

  // On sign-in: apply the account's theme/language; store the device's choice if the account has none yet.
  useEffect(() => {
    if (!user) {
      applied.current = null;
      return;
    }
    if (applied.current === user.id) return;
    applied.current = user.id;
    const p = user.preferences;
    if (p.theme && p.theme !== theme) setTheme(p.theme);
    if (p.uiLanguage && p.uiLanguage !== lang) setLang(p.uiLanguage);
    const missing: Preferences = {};
    if (!p.theme) missing.theme = theme;
    if (!p.uiLanguage) missing.uiLanguage = lang;
    if (Object.keys(missing).length) save(missing, { silent: true });
  }, [user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Header toggles change theme/language on the device; keep the account in sync.
  useEffect(() => {
    if (!user || applied.current !== user.id) return;
    const patch: Preferences = {};
    if (user.preferences.theme && theme !== user.preferences.theme) patch.theme = theme;
    if (user.preferences.uiLanguage && lang !== user.preferences.uiLanguage) patch.uiLanguage = lang;
    if (Object.keys(patch).length) save(patch, { silent: true });
  }, [theme, lang]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    document.documentElement.dataset.motion = prefs.reducedMotion === "reduce" ? "reduce" : "";
  }, [prefs.reducedMotion]);

  return <Ctx.Provider value={{ prefs, save }}>{children}</Ctx.Provider>;
}

export function usePreferences() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("usePreferences must be used inside PreferencesProvider");
  return ctx;
}
