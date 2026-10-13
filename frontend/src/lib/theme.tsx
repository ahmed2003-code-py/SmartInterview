import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

export type ThemePref = "light" | "dark" | "system";

const ThemeContext = createContext<{ theme: ThemePref; resolved: "light" | "dark"; setTheme: (t: ThemePref) => void } | null>(null);

const media = () => window.matchMedia("(prefers-color-scheme: dark)");

function readPref(): ThemePref {
  try {
    const v = localStorage.getItem("theme");
    if (v === "light" || v === "dark" || v === "system") return v;
  } catch {
    /* ignore */
  }
  return "system";
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<ThemePref>(readPref);
  const [systemDark, setSystemDark] = useState(() => media().matches);

  useEffect(() => {
    const mq = media();
    const onChange = () => setSystemDark(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  const resolved = theme === "system" ? (systemDark ? "dark" : "light") : theme;

  useEffect(() => {
    document.documentElement.classList.toggle("dark", resolved === "dark");
  }, [resolved]);

  const setTheme = (t: ThemePref) => {
    setThemeState(t);
    try {
      localStorage.setItem("theme", t);
    } catch {
      /* ignore */
    }
  };

  return <ThemeContext.Provider value={{ theme, resolved, setTheme }}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used inside ThemeProvider");
  return ctx;
}
