import { NavLink, Outlet } from "react-router-dom";
import { History, LayoutGrid, LogOut, Plus } from "lucide-react";
import { Logo } from "./Logo";
import { LanguageSwitch, ThemeToggle } from "./Preferences";
import { Menu, MenuContent, MenuItem, MenuLabel, MenuSeparator, MenuTrigger } from "@/components/ui/dropdown";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/i18n";
import { cn } from "@/lib/utils";

function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]).join("").toUpperCase();
}

export function AppLayout() {
  const { d } = useI18n();
  const { user, logout } = useAuth();
  const links = [
    { to: "/dashboard", label: d.nav.dashboard, icon: LayoutGrid },
    { to: "/interviews/new", label: d.nav.newInterview, icon: Plus },
    { to: "/history", label: d.nav.history, icon: History },
  ];

  return (
    <div className="min-h-dvh bg-bg">
      <header className="sticky top-0 z-40 border-b border-border bg-bg/90 backdrop-blur-sm">
        <div className="mx-auto flex h-14 max-w-5xl items-center gap-8 px-4 sm:px-6">
          <Logo to="/dashboard" />
          <nav className="hidden h-full items-center gap-6 md:flex">
            {links.map((l) => (
              <NavLink
                key={l.to}
                to={l.to}
                end
                className={({ isActive }) => cn("flex h-full items-center border-b-2 text-sm transition-colors", isActive ? "border-fg font-medium text-fg" : "border-transparent text-muted hover:text-fg")}
              >
                {l.label}
              </NavLink>
            ))}
          </nav>
          <div className="ms-auto flex items-center gap-1">
            <LanguageSwitch />
            <ThemeToggle />
            <Menu>
              <MenuTrigger asChild>
                <button className="ms-1 grid size-8 place-items-center rounded-full border border-border-strong bg-surface text-xs font-semibold text-fg outline-none focus-visible:ring-3 focus-visible:ring-primary/30" aria-label={d.nav.menu}>
                  {user ? initials(user.name) : ""}
                </button>
              </MenuTrigger>
              <MenuContent className="w-56">
                <MenuLabel>
                  <span className="block truncate text-sm font-medium text-fg">{user?.name}</span>
                  <span className="block truncate">{user?.email}</span>
                </MenuLabel>
                <MenuSeparator />
                <MenuItem onSelect={() => logout()}>
                  <LogOut className="rtl:-scale-x-100" /> {d.common.logout}
                </MenuItem>
              </MenuContent>
            </Menu>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 pt-8 pb-28 sm:px-6 sm:pt-12 md:pb-20">
        <Outlet />
      </main>

      {/* Mobile: compact bottom tab bar (thumb-reachable, never covers content thanks to main's padding) */}
      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-bg/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-sm md:hidden" aria-label={d.nav.menu}>
        <div className="grid grid-cols-3">
          {links.map((l) => (
            <NavLink
              key={l.to}
              to={l.to}
              end
              className={({ isActive }) => cn("flex h-14 flex-col items-center justify-center gap-0.5 text-[11px] transition-colors", isActive ? "font-medium text-fg" : "text-subtle")}
            >
              <l.icon className="size-5" strokeWidth={1.75} />
              {l.label}
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  );
}
