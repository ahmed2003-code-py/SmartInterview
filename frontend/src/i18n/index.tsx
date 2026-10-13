import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { en, type Dict } from "./en";
import { ar } from "./ar";

export type Lang = "en" | "ar";
const dicts: Record<Lang, Dict> = { en, ar };

interface I18n {
  lang: Lang;
  dir: "ltr" | "rtl";
  d: Dict;
  setLang: (lang: Lang) => void;
  /** Replace {placeholders} in a dictionary string. */
  fmt: (text: string, vars: Record<string, string | number>) => string;
  formatDate: (date: string | Date, withTime?: boolean) => string;
  formatDuration: (seconds: number | null | undefined) => string;
}

const I18nContext = createContext<I18n | null>(null);

function initialLang(): Lang {
  try {
    const saved = localStorage.getItem("lang");
    if (saved === "en" || saved === "ar") return saved;
  } catch {
    /* storage unavailable */
  }
  return navigator.language?.startsWith("ar") ? "ar" : "en";
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(initialLang);

  useEffect(() => {
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === "ar" ? "rtl" : "ltr";
  }, [lang]);

  const setLang = useCallback((next: Lang) => {
    setLangState(next);
    try {
      localStorage.setItem("lang", next);
    } catch {
      /* ignore */
    }
  }, []);

  const value = useMemo<I18n>(() => buildI18n(lang, setLang), [lang, setLang]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

/**
 * Renders children in a fixed language (e.g. the interview room follows the interview's language),
 * temporarily switching the document direction and restoring the user's language on exit.
 */
export function I18nOverride({ lang, children }: { lang: Lang; children: ReactNode }) {
  const parent = useI18n();
  const value = useMemo<I18n>(() => buildI18n(lang, parent.setLang), [lang, parent.setLang]);
  useEffect(() => {
    const el = document.documentElement;
    el.lang = lang;
    el.dir = lang === "ar" ? "rtl" : "ltr";
    return () => {
      el.lang = parent.lang;
      el.dir = parent.dir;
    };
  }, [lang, parent.lang, parent.dir]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

function buildI18n(lang: Lang, setLang: (lang: Lang) => void): I18n {
    // Arabic month names with Western digits, consistent with scores elsewhere in the UI.
    const locale = lang === "ar" ? "ar-EG-u-nu-latn" : "en-GB";
    return {
      lang,
      dir: lang === "ar" ? "rtl" : "ltr",
      d: dicts[lang],
      setLang,
      fmt: (text, vars) => text.replace(/\{(\w+)\}/g, (_, k) => String(vars[k] ?? "")),
      formatDate: (date, withTime) =>
        new Intl.DateTimeFormat(locale, { day: "numeric", month: "short", year: "numeric", ...(withTime ? { hour: "numeric", minute: "2-digit" } : {}) }).format(new Date(date)),
      formatDuration: (seconds) => {
        if (seconds == null) return "—";
        const m = Math.floor(seconds / 60);
        const h = Math.floor(m / 60);
        if (lang === "ar") return h ? `${h} س ${m % 60} د` : m ? `${m} د` : `${seconds} ث`;
        return h ? `${h}h ${m % 60}m` : m ? `${m} min` : `${seconds} sec`;
      },
    };
}

export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n must be used inside I18nProvider");
  return ctx;
}
