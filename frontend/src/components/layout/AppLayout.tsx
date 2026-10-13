import { Link, NavLink, Outlet, useLocation } from "react-router-dom";
import { ChevronDown, History, LayoutGrid, LogOut, Plus, Settings as SettingsIcon, UserRound } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { Logo } from "./Logo";
import { LanguageSwitch } from "./Preferences";
import { Menu, MenuContent, MenuItem, MenuLabel, MenuSeparator, MenuTrigger } from "@/components/ui/dropdown";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/i18n";
import { m } from "@/lib/motion";
import { cn } from "@/lib/utils";

export function AppLayout() {
  const { d } = useI18n();
  const { user, logout } = useAuth();
  const { pathname } = useLocation();
  const links = [
    { to: "/dashboard", label: d.nav.dashboard, icon: LayoutGrid },
    { to: "/interviews/new", label: d.nav.newInterview, icon: Plus },
    { to: "/history", label: d.nav.history, icon: History },
  ];

  return (
    <div className="min-h-dvh bg-bg">
      <header className="sticky top-0 z-40 border-b border-border/70 bg-bg/80 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-6 px-4 sm:px-6">
          <Logo to="/dashboard" />
          <nav className="hidden items-center gap-1 md:flex" aria-label={d.nav.menu}>
            {links.map((l) => (
              <NavLink key={l.to} to={l.to} end className={({ isActive }) => cn("relative rounded-lg px-3 py-1.5 text-sm transition-colors", isActive ? "font-medium text-fg" : "text-muted hover:text-fg")}>
                {({ isActive }) => (
                  <>
                    {isActive && <m.span layoutId="nav-pill" className="absolute inset-0 rounded-lg bg-surface shadow-sm ring-1 ring-border" transition={{ type: "spring", bounce: 0.15, duration: 0.4 }} />}
                    <span className="relative">{l.label}</span>
                  </>
                )}
              </NavLink>
            ))}
          </nav>
          <div className="ms-auto flex items-center gap-1">
            <LanguageSwitch />
            <Menu>
              <MenuTrigger asChild>
                <button
                  className="press ms-1 flex items-center gap-2 rounded-full p-0.5 outline-none transition-colors hover:bg-surface-2 focus-visible:ring-3 focus-visible:ring-primary/30 md:py-1 md:ps-1 md:pe-2.5"
                  aria-label={d.nav.account}
                >
                  <Avatar user={user} className="size-8 text-[13px]" />
                  <span className="hidden max-w-32 truncate text-sm font-medium md:inline" dir="auto">
                    {user?.name.split(" ")[0]}
                  </span>
                  <ChevronDown className="hidden size-3.5 text-subtle md:block" />
                </button>
              </MenuTrigger>
              <MenuContent className="w-60">
                <MenuLabel>
                  <span className="flex items-center gap-3 py-1">
                    <Avatar user={user} className="size-9 text-sm" />
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium text-fg" dir="auto">
                        {user?.name}
                      </span>
                      <span className="block truncate" dir="ltr">
                        {user?.email}
                      </span>
                    </span>
                  </span>
                </MenuLabel>
                <MenuSeparator />
                <MenuItem asChild>
                  <Link to="/profile">
                    <UserRound /> {d.nav.profile}
                  </Link>
                </MenuItem>
                <MenuItem asChild>
                  <Link to="/settings">
                    <SettingsIcon /> {d.nav.settings}
                  </Link>
                </MenuItem>
                <MenuSeparator />
                <MenuItem onSelect={() => logout()}>
                  <LogOut className="rtl:-scale-x-100" /> {d.common.logout}
                </MenuItem>
              </MenuContent>
            </Menu>
          </div>
        </div>
      </header>
      <m.main
        key={pathname}
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.22 }}
        className="mx-auto max-w-6xl px-4 pt-6 pb-28 sm:px-6 sm:pt-10 md:pb-20"
      >
        <Outlet />
      </m.main>

      {/* Mobile: bottom tab bar; "New interview" is the raised primary action. */}
      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-border/70 bg-bg/90 pb-[env(safe-area-inset-bottom)] backdrop-blur-md md:hidden" aria-label={d.nav.menu}>
        <div className="grid h-16 grid-cols-3">
          {links.map((l, i) => (
            <NavLink key={l.to} to={l.to} end className={({ isActive }) => cn("press flex flex-col items-center justify-center gap-1 text-[11px] transition-colors", isActive ? "font-medium text-fg" : "text-subtle")}>
              {({ isActive }) =>
                i === 1 ? (
                  <>
                    <span className={cn("grid h-8 w-11 place-items-center rounded-full text-white shadow-md ai-gradient", isActive && "ring-4 ring-primary/15")}>
                      <l.icon className="size-[18px]" strokeWidth={2.25} />
                    </span>
                    {l.label}
                  </>
                ) : (
                  <>
                    <l.icon className="size-5" strokeWidth={isActive ? 2.1 : 1.75} />
                    {l.label}
                  </>
                )
              }
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  );
}
