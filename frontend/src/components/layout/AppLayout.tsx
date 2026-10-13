import { NavLink, Outlet, Link, useLocation } from "react-router-dom";
import { History, LayoutGrid, LogOut, Menu as MenuIcon, Plus } from "lucide-react";
import { Logo } from "./Logo";
import { LanguageSwitch, ThemeToggle } from "./Preferences";
import { Button } from "@/components/ui/button";
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
  const { pathname } = useLocation();
  const links = [
    { to: "/dashboard", label: d.nav.dashboard, icon: LayoutGrid },
    { to: "/history", label: d.nav.history, icon: History },
  ];

  return (
    <div className="min-h-dvh bg-bg">
      <header className="sticky top-0 z-40 border-b border-border bg-bg/85 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-6 px-4 sm:px-6">
          <Logo to="/dashboard" />
          <nav className="hidden items-center gap-1 md:flex">
            {links.map((l) => (
              <NavLink
                key={l.to}
                to={l.to}
                className={({ isActive }) => cn("rounded-md px-3 py-1.5 text-sm transition-colors", isActive ? "bg-surface-2 font-medium text-fg" : "text-muted hover:text-fg")}
              >
                {l.label}
              </NavLink>
            ))}
          </nav>
          <div className="ms-auto flex items-center gap-1">
            {!["/interviews/new", "/dashboard"].includes(pathname) && (
              <Button asChild size="sm" className="me-2 hidden sm:inline-flex">
                <Link to="/interviews/new">
                  <Plus className="size-4" />
                  {d.nav.newInterview}
                </Link>
              </Button>
            )}
            <LanguageSwitch />
            <ThemeToggle />
            <Menu>
              <MenuTrigger asChild>
                <button className="ms-1 grid size-9 place-items-center rounded-full bg-primary-soft text-[13px] font-semibold text-primary-soft-fg outline-none focus-visible:ring-3 focus-visible:ring-primary/30" aria-label={d.nav.menu}>
                  <span className="max-md:hidden">{user ? initials(user.name) : ""}</span>
                  <MenuIcon className="size-4 md:hidden" />
                </button>
              </MenuTrigger>
              <MenuContent className="w-56">
                <MenuLabel>
                  <span className="block truncate text-sm font-medium text-fg">{user?.name}</span>
                  <span className="block truncate">{user?.email}</span>
                </MenuLabel>
                <MenuSeparator />
                <div className="md:hidden">
                  <MenuItem asChild>
                    <Link to="/interviews/new">
                      <Plus /> {d.nav.newInterview}
                    </Link>
                  </MenuItem>
                  {links.map((l) => (
                    <MenuItem asChild key={l.to}>
                      <Link to={l.to}>
                        <l.icon /> {l.label}
                      </Link>
                    </MenuItem>
                  ))}
                  <MenuSeparator />
                </div>
                <MenuItem onSelect={() => logout()}>
                  <LogOut className="rtl:-scale-x-100" /> {d.common.logout}
                </MenuItem>
              </MenuContent>
            </Menu>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 pt-8 pb-20 sm:px-6 sm:pt-10">
        <Outlet />
      </main>
    </div>
  );
}
