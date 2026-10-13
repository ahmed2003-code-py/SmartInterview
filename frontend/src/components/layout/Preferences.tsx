import { Languages, Monitor, Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Menu, MenuContent, MenuRadioGroup, MenuRadioItem, MenuTrigger } from "@/components/ui/dropdown";
import { Tooltip } from "@/components/ui/tooltip";
import { useI18n } from "@/i18n";
import { useTheme, type ThemePref } from "@/lib/theme";

export function ThemeToggle() {
  const { d } = useI18n();
  const { theme, resolved, setTheme } = useTheme();
  return (
    <Menu>
      <Tooltip content={d.common.theme}>
        <MenuTrigger asChild>
          <Button variant="ghost" size="icon" aria-label={d.common.theme}>
            {resolved === "dark" ? <Moon className="size-[18px]" /> : <Sun className="size-[18px]" />}
          </Button>
        </MenuTrigger>
      </Tooltip>
      <MenuContent>
        <MenuRadioGroup value={theme} onValueChange={(v) => setTheme(v as ThemePref)}>
          <MenuRadioItem value="light">
            <Sun /> {d.common.light}
          </MenuRadioItem>
          <MenuRadioItem value="dark">
            <Moon /> {d.common.dark}
          </MenuRadioItem>
          <MenuRadioItem value="system">
            <Monitor /> {d.common.system}
          </MenuRadioItem>
        </MenuRadioGroup>
      </MenuContent>
    </Menu>
  );
}

/** One-click toggle; shows the language you would switch to. */
export function LanguageSwitch({ compact }: { compact?: boolean }) {
  const { lang, setLang, d } = useI18n();
  const next = lang === "ar" ? "en" : "ar";
  return (
    <Tooltip content={d.common.language}>
      <Button variant="ghost" size={compact ? "icon" : "sm"} onClick={() => setLang(next)} aria-label={d.common.language} className={compact ? "" : "h-9 px-2.5"}>
        {compact ? <Languages className="size-[18px]" /> : <span className={next === "ar" ? "font-[IBM_Plex_Sans_Arabic] text-[15px]" : "text-[13px]"}>{next === "ar" ? "العربية" : "English"}</span>}
      </Button>
    </Tooltip>
  );
}
