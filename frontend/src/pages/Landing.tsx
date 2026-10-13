import { Link } from "react-router-dom";
import { ArrowRight, Menu as MenuIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/layout/Logo";
import { LanguageSwitch, ThemeToggle } from "@/components/layout/Preferences";
import { Menu, MenuContent, MenuItem, MenuSeparator, MenuTrigger } from "@/components/ui/dropdown";
import { Skeleton } from "@/components/ui/skeleton";
import { InterviewPreview } from "@/features/landing/InterviewPreview";
import { ScoreBars } from "@/features/report/ScoreBars";
import { useI18n } from "@/i18n";
import { useAuth } from "@/lib/auth";
import { useFetch } from "@/hooks/useFetch";
import { api, type Role } from "@/lib/api";

function Header() {
  const { d } = useI18n();
  const { user } = useAuth();
  const links = [
    { href: "#how-it-works", label: d.nav.howItWorks },
    { href: "#features", label: d.nav.features },
    { href: "#practice", label: d.nav.practice },
    { href: "#about", label: d.nav.about },
  ];
  return (
    <header className="sticky top-0 z-40 border-b border-border bg-bg/90 backdrop-blur-sm">
      <div className="mx-auto flex h-14 max-w-6xl items-center gap-8 px-4 sm:px-6">
        <Logo />
        <nav className="hidden items-center gap-6 lg:flex">
          {links.map((l) => (
            <a key={l.href} href={l.href} className="text-sm text-muted transition-colors hover:text-fg">
              {l.label}
            </a>
          ))}
        </nav>
        <div className="ms-auto flex items-center gap-1">
          <LanguageSwitch />
          <ThemeToggle />
          {user ? (
            <Button asChild size="sm" className="ms-2">
              <Link to="/dashboard">{d.nav.dashboard}</Link>
            </Button>
          ) : (
            <>
              <Button asChild variant="ghost" size="sm" className="hidden text-fg sm:inline-flex">
                <Link to="/login">{d.common.login}</Link>
              </Button>
              <Button asChild size="sm" className="ms-1 hidden sm:inline-flex">
                <Link to="/register">{d.common.getStarted}</Link>
              </Button>
            </>
          )}
          <Menu>
            <MenuTrigger asChild>
              <Button variant="ghost" size="icon" className="lg:hidden" aria-label={d.nav.menu}>
                <MenuIcon className="size-[18px]" />
              </Button>
            </MenuTrigger>
            <MenuContent>
              {links.map((l) => (
                <MenuItem key={l.href} asChild>
                  <a href={l.href}>{l.label}</a>
                </MenuItem>
              ))}
              {!user && (
                <>
                  <MenuSeparator />
                  <MenuItem asChild>
                    <Link to="/login">{d.common.login}</Link>
                  </MenuItem>
                  <MenuItem asChild>
                    <Link to="/register" className="font-medium">
                      {d.common.getStarted}
                    </Link>
                  </MenuItem>
                </>
              )}
            </MenuContent>
          </Menu>
        </div>
      </div>
    </header>
  );
}

function SectionTitle({ eyebrow, title, body, className }: { eyebrow: string; title: string; body?: string; className?: string }) {
  return (
    <div className={className}>
      <p className="text-[13px] font-medium text-subtle">{eyebrow}</p>
      <h2 className="mt-3 font-display text-[2rem] leading-[1.15] font-[450] text-balance sm:text-[2.6rem]">{title}</h2>
      {body && <p className="mt-4 max-w-lg text-[16px] leading-relaxed text-muted">{body}</p>}
    </div>
  );
}

function Hero() {
  const { d } = useI18n();
  return (
    <section id="top" className="mx-auto max-w-6xl px-4 pt-14 sm:px-6 sm:pt-20">
      <div className="grid animate-fade-up items-end gap-8 lg:grid-cols-[1.25fr_1fr] lg:gap-16">
        <div>
          <p className="text-[13px] font-medium text-subtle">{d.common.tagline}</p>
          <h1 className="mt-5 font-display text-[2.7rem] leading-[1.06] font-[450] tracking-[-0.015em] text-balance sm:text-[4rem]">
            {d.landing.heroTitle1} <span className="text-muted italic">{d.landing.heroTitle2}</span>
          </h1>
        </div>
        <div className="lg:pb-2">
          <p className="text-[17px] leading-relaxed text-muted">{d.landing.heroSubtitle}</p>
          <div className="mt-7 flex flex-wrap items-center gap-3">
            <Button asChild size="lg">
              <Link to="/register">
                {d.common.startPracticing}
                <ArrowRight className="size-4 rtl:-scale-x-100" />
              </Link>
            </Button>
            <Button asChild size="lg" variant="ghost" className="text-fg">
              <a href="#how-it-works">{d.nav.howItWorks}</a>
            </Button>
          </div>
        </div>
      </div>
      <div className="mt-12 animate-fade-up [animation-delay:120ms] sm:mt-16">
        <InterviewPreview />
        <p className="mt-4 text-center text-[13px] text-subtle">{d.landing.heroNote}</p>
      </div>
    </section>
  );
}

function HowItWorks() {
  const { d } = useI18n();
  return (
    <section id="how-it-works" className="mx-auto max-w-6xl px-4 py-24 sm:px-6 lg:py-32">
      <div className="grid gap-12 lg:grid-cols-[0.85fr_1.15fr] lg:gap-20">
        <SectionTitle eyebrow={d.landing.howEyebrow} title={d.landing.howTitle} className="lg:sticky lg:top-24 lg:self-start" />
        <ol className="border-t border-border">
          {d.landing.steps.map((s, i) => (
            <li key={s.title} className="grid grid-cols-[2.5rem_1fr] gap-x-4 border-b border-border py-6 sm:grid-cols-[3.5rem_1fr]">
              <span className="font-display text-[1.75rem] leading-none text-subtle tabular-nums">{i + 1}</span>
              <div>
                <h3 className="font-medium">{s.title}</h3>
                <p className="mt-1.5 text-[15px] leading-relaxed text-muted">{s.body}</p>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

function Benefits() {
  const { d } = useI18n();
  return (
    <section id="features" className="border-y border-border bg-bg-subtle">
      <div className="mx-auto max-w-6xl px-4 py-24 sm:px-6 lg:py-32">
        <SectionTitle eyebrow={d.landing.featuresEyebrow} title={d.landing.featuresTitle} body={d.landing.featuresBody} className="max-w-2xl" />
        <div className="mt-14 grid gap-x-16 gap-y-10 md:grid-cols-2">
          {d.landing.features.map((f) => (
            <div key={f.title} className="border-t border-border-strong/70 pt-5">
              <h3 className="font-medium">{f.title}</h3>
              <p className="mt-2 max-w-md text-[15px] leading-relaxed text-muted">{f.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function ReportPreview() {
  const { d } = useI18n();
  return (
    <section className="mx-auto max-w-6xl px-4 py-24 sm:px-6 lg:py-32">
      <div className="grid items-center gap-14 lg:grid-cols-[0.85fr_1.15fr] lg:gap-20">
        <SectionTitle eyebrow={d.landing.exampleEyebrow} title={d.landing.exampleTitle} body={d.landing.exampleBody} />
        <div className="rounded-xl border border-border bg-surface p-6 sm:p-9" aria-hidden>
          <div className="flex flex-wrap items-end justify-between gap-4 border-b border-border pb-7">
            <div>
              <p className="text-[13px] text-subtle">{d.report.overall}</p>
              <p className="mt-2 font-display text-6xl leading-none font-[450] tabular-nums">
                82<span className="text-2xl text-subtle"> / 100</span>
              </p>
            </div>
            <p className="text-sm text-muted">
              {d.landing.previewRole} · <span className="text-success">{d.report.bands.good}</span>
            </p>
          </div>
          <ScoreBars className="mt-7" scores={{ communication: 86, clarity: 80, relevance: 88, subjectKnowledge: 78, educationalReasoning: 64 }} />
          <div className="mt-8 grid gap-6 border-t border-border pt-7 text-sm sm:grid-cols-2">
            <div>
              <p className="font-medium">{d.report.strengths}</p>
              <p className="mt-1.5 leading-relaxed text-muted">{d.landing.exampleStrength}</p>
            </div>
            <div>
              <p className="font-medium">{d.report.improvements}</p>
              <p className="mt-1.5 leading-relaxed text-muted">{d.landing.exampleImprove}</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function Roles() {
  const { d, lang } = useI18n();
  const { data, loading } = useFetch(() => api.get<{ roles: Role[] }>("/roles"), []);
  return (
    <section id="practice" className="border-t border-border">
      <div className="mx-auto max-w-6xl px-4 py-24 sm:px-6 lg:py-32">
        <SectionTitle eyebrow={d.landing.practiceEyebrow} title={d.landing.practiceTitle} body={d.landing.practiceBody} />
        <ul className="mt-12 grid gap-x-16 sm:grid-cols-2">
          {loading
            ? Array.from({ length: 8 }, (_, i) => (
                <li key={i} className="border-t border-border py-4">
                  <Skeleton className="h-4 w-40" />
                </li>
              ))
            : data?.roles.map((r) => (
                <li key={r.id} className="border-t border-border">
                  <Link to="/register" className="group flex items-baseline justify-between gap-6 py-4">
                    <span>
                      <span className="block font-medium transition-colors group-hover:text-primary">{lang === "ar" ? r.nameAr : r.nameEn}</span>
                      <span className="mt-0.5 block text-sm text-muted">{lang === "ar" ? r.descriptionAr : r.descriptionEn}</span>
                    </span>
                    <ArrowRight className="size-4 shrink-0 text-subtle transition group-hover:text-primary rtl:-scale-x-100" />
                  </Link>
                </li>
              ))}
        </ul>
      </div>
    </section>
  );
}

function CTA() {
  const { d } = useI18n();
  return (
    <section className="border-t border-border bg-bg-subtle">
      <div className="mx-auto flex max-w-6xl flex-col items-start gap-8 px-4 py-20 sm:px-6 md:flex-row md:items-end md:justify-between lg:py-24">
        <div>
          <h2 className="max-w-xl font-display text-[2rem] leading-tight font-[450] text-balance sm:text-[2.6rem]">{d.landing.ctaTitle}</h2>
          <p className="mt-3 text-muted">{d.landing.ctaBody}</p>
        </div>
        <Button asChild size="lg">
          <Link to="/register">
            {d.common.startPracticing}
            <ArrowRight className="size-4 rtl:-scale-x-100" />
          </Link>
        </Button>
      </div>
    </section>
  );
}

function Footer() {
  const { d } = useI18n();
  return (
    <footer id="about" className="border-t border-border">
      <div className="mx-auto flex max-w-6xl flex-col gap-8 px-4 py-12 sm:px-6 md:flex-row md:justify-between">
        <div className="max-w-sm">
          <Logo />
          <p className="mt-4 text-sm leading-relaxed text-muted">{d.landing.footerAbout}</p>
        </div>
        <div className="flex gap-16 text-sm">
          <div className="space-y-2.5">
            <a href="#how-it-works" className="block text-muted hover:text-fg">{d.nav.howItWorks}</a>
            <a href="#features" className="block text-muted hover:text-fg">{d.nav.features}</a>
            <a href="#practice" className="block text-muted hover:text-fg">{d.nav.practice}</a>
          </div>
          <div className="space-y-2.5">
            <Link to="/login" className="block text-muted hover:text-fg">{d.common.login}</Link>
            <Link to="/register" className="block text-muted hover:text-fg">{d.common.getStarted}</Link>
          </div>
        </div>
      </div>
      <p className="mx-auto max-w-6xl px-4 pb-10 text-[13px] text-subtle sm:px-6">
        © 2026 {d.landing.footerRights}
      </p>
    </footer>
  );
}

export default function Landing() {
  return (
    <div className="min-h-dvh overflow-x-clip bg-bg">
      <Header />
      <main>
        <Hero />
        <HowItWorks />
        <Benefits />
        <ReportPreview />
        <Roles />
        <CTA />
      </main>
      <Footer />
    </div>
  );
}
