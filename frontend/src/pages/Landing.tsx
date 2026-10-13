import { Link } from "react-router-dom";
import { ArrowRight, AudioLines, BarChart3, FileText, Languages, ListChecks, Menu as MenuIcon, MessagesSquare } from "lucide-react";
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

const FEATURE_ICONS = [AudioLines, MessagesSquare, Languages, FileText, ListChecks, BarChart3];

function Header() {
  const { d } = useI18n();
  const { user } = useAuth();
  const links = [
    { href: "#top", label: d.nav.home },
    { href: "#features", label: d.nav.features },
    { href: "#how-it-works", label: d.nav.howItWorks },
    { href: "#practice", label: d.nav.practice },
    { href: "#about", label: d.nav.about },
  ];
  return (
    <header className="sticky top-0 z-40 border-b border-border/70 bg-bg/85 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-8 px-4 sm:px-6">
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
                    <Link to="/register" className="!text-primary font-medium">
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

function SectionHeading({ eyebrow, title, body, className }: { eyebrow: string; title: string; body?: string; className?: string }) {
  return (
    <div className={className}>
      <p className="text-sm font-medium text-primary">{eyebrow}</p>
      <h2 className="mt-3 text-3xl font-semibold tracking-tight text-balance sm:text-[2.5rem] sm:leading-[1.1]">{title}</h2>
      {body && <p className="mt-4 max-w-xl text-[17px] leading-relaxed text-muted">{body}</p>}
    </div>
  );
}

function Hero() {
  const { d } = useI18n();
  return (
    <section id="top" className="mx-auto grid max-w-6xl items-center gap-14 px-4 pt-14 pb-20 sm:px-6 lg:grid-cols-[1fr_1.08fr] lg:gap-12 lg:pt-24 lg:pb-28">
      <div className="animate-fade-up">
        <p className="inline-flex items-center gap-2 rounded-full border border-border bg-surface px-3 py-1 text-[13px] font-medium text-muted">
          <span className="size-1.5 rounded-full bg-primary" />
          {d.common.tagline}
        </p>
        <h1 className="mt-6 text-[2.6rem] leading-[1.08] font-semibold tracking-[-0.03em] text-balance sm:text-6xl sm:leading-[1.04]">
          {d.landing.heroTitle1}
          <br />
          <span className="bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent rtl:bg-gradient-to-l">{d.landing.heroTitle2}</span>
        </h1>
        <p className="mt-6 max-w-xl text-lg leading-relaxed text-muted">{d.landing.heroSubtitle}</p>
        <div className="mt-9 flex flex-wrap gap-3">
          <Button asChild size="lg">
            <Link to="/register">
              {d.common.startPracticing}
              <ArrowRight className="size-4 rtl:-scale-x-100" />
            </Link>
          </Button>
          <Button asChild size="lg" variant="secondary">
            <a href="#how-it-works">{d.nav.howItWorks}</a>
          </Button>
        </div>
        <p className="mt-6 text-sm text-subtle">{d.landing.heroNote}</p>
      </div>
      <div className="animate-fade-up [animation-delay:120ms]">
        <InterviewPreview />
      </div>
    </section>
  );
}

function Features() {
  const { d } = useI18n();
  return (
    <section id="features" className="border-t border-border">
      <div className="mx-auto grid max-w-6xl gap-12 px-4 py-20 sm:px-6 lg:grid-cols-[0.9fr_1.6fr] lg:gap-16 lg:py-28">
        <SectionHeading eyebrow={d.landing.featuresEyebrow} title={d.landing.featuresTitle} body={d.landing.featuresBody} className="lg:sticky lg:top-28 lg:self-start" />
        <div className="grid gap-x-10 gap-y-10 sm:grid-cols-2">
          {d.landing.features.map((f, i) => {
            const Icon = FEATURE_ICONS[i];
            return (
              <div key={f.title} className="border-t border-border pt-6">
                <Icon className="size-5 text-primary" strokeWidth={1.75} />
                <h3 className="mt-4 font-semibold">{f.title}</h3>
                <p className="mt-1.5 text-[15px] leading-relaxed text-muted">{f.body}</p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function HowItWorks() {
  const { d } = useI18n();
  return (
    <section id="how-it-works" className="border-t border-border bg-bg-subtle">
      <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6 lg:py-28">
        <SectionHeading eyebrow={d.landing.howEyebrow} title={d.landing.howTitle} />
        <ol className="mt-14 grid gap-10 sm:grid-cols-2 lg:grid-cols-4 lg:gap-8">
          {d.landing.steps.map((s, i) => (
            <li key={s.title} className="relative">
              <div className="flex items-center gap-3">
                <span className="grid size-8 place-items-center rounded-md border border-border-strong bg-surface text-[13px] font-semibold tabular-nums">{i + 1}</span>
                {i < 3 && <span className="hidden h-px flex-1 bg-border-strong lg:block" />}
              </div>
              <h3 className="mt-5 font-semibold">{s.title}</h3>
              <p className="mt-1.5 text-[15px] leading-relaxed text-muted">{s.body}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

function Practice() {
  const { d, lang } = useI18n();
  const { data, loading } = useFetch(() => api.get<{ roles: Role[] }>("/roles"), []);
  return (
    <section id="practice" className="border-t border-border">
      <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6 lg:py-28">
        <SectionHeading eyebrow={d.landing.practiceEyebrow} title={d.landing.practiceTitle} body={d.landing.practiceBody} />
        <ul className="mt-12 grid border-t border-border sm:grid-cols-2 lg:grid-cols-4">
          {loading
            ? Array.from({ length: 8 }, (_, i) => (
                <li key={i} className="border-b border-border p-5">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="mt-3 h-3 w-full" />
                </li>
              ))
            : data?.roles.map((r) => (
                <li key={r.id} className="border-b border-border sm:odd:border-e lg:border-e lg:[&:nth-child(4n)]:border-e-0">
                  <Link to="/register" className="group block h-full p-5 transition-colors hover:bg-bg-subtle">
                    <span className="flex items-center justify-between gap-2 font-medium">
                      {lang === "ar" ? r.nameAr : r.nameEn}
                      <ArrowRight className="size-4 -translate-x-1 text-primary opacity-0 transition group-hover:translate-x-0 group-hover:opacity-100 rtl:-scale-x-100 rtl:translate-x-1" />
                    </span>
                    <span className="mt-1.5 block text-sm leading-relaxed text-muted">{lang === "ar" ? r.descriptionAr : r.descriptionEn}</span>
                  </Link>
                </li>
              ))}
        </ul>
      </div>
    </section>
  );
}

function ExampleEvaluation() {
  const { d } = useI18n();
  return (
    <section className="border-t border-border bg-bg-subtle">
      <div className="mx-auto grid max-w-6xl items-center gap-12 px-4 py-20 sm:px-6 lg:grid-cols-2 lg:gap-20 lg:py-28">
        <SectionHeading eyebrow={d.landing.exampleEyebrow} title={d.landing.exampleTitle} body={d.landing.exampleBody} />
        <div className="rounded-xl border border-border bg-surface p-6 shadow-sm sm:p-8" aria-hidden>
          <div className="flex items-end justify-between gap-4 border-b border-border pb-6">
            <div>
              <p className="text-sm text-muted">{d.report.overall}</p>
              <p className="mt-1 text-5xl font-semibold tracking-tight tabular-nums">
                82<span className="text-xl font-normal text-subtle"> / 100</span>
              </p>
            </div>
            <span className="rounded-sm bg-success-soft px-2 py-1 text-[13px] font-medium text-success">{d.report.bands.good}</span>
          </div>
          <ScoreBars className="mt-6" scores={{ communication: 86, clarity: 80, relevance: 88, subjectKnowledge: 78, educationalReasoning: 76 }} />
          <div className="mt-7 grid gap-4 border-t border-border pt-6 text-sm sm:grid-cols-2">
            <div>
              <p className="font-medium text-success">{d.report.strengths}</p>
              <p className="mt-1 leading-relaxed text-muted">{d.landing.exampleStrength}</p>
            </div>
            <div>
              <p className="font-medium text-warning">{d.report.improvements}</p>
              <p className="mt-1 leading-relaxed text-muted">{d.landing.exampleImprove}</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function CTA() {
  const { d } = useI18n();
  return (
    <section className="border-t border-border">
      <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6 lg:py-24">
        <div className="flex flex-col items-start justify-between gap-8 rounded-2xl bg-navy px-6 py-12 text-white sm:px-12 md:flex-row md:items-center">
          <div>
            <h2 className="text-3xl font-semibold tracking-tight text-balance">{d.landing.ctaTitle}</h2>
            <p className="mt-3 text-white/65">{d.landing.ctaBody}</p>
          </div>
          <Button asChild size="lg" variant="inverted">
            <Link to="/register">
              {d.common.startPracticing}
              <ArrowRight className="size-4 rtl:-scale-x-100" />
            </Link>
          </Button>
        </div>
      </div>
    </section>
  );
}

function Footer() {
  const { d } = useI18n();
  return (
    <footer id="about" className="border-t border-border">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-14 sm:px-6 md:grid-cols-[1.5fr_1fr_1fr]">
        <div>
          <Logo />
          <p className="mt-4 max-w-sm text-sm leading-relaxed text-muted">{d.landing.footerAbout}</p>
        </div>
        <div className="space-y-2.5 text-sm">
          <p className="font-medium">{d.nav.practice}</p>
          <a href="#features" className="block text-muted hover:text-fg">{d.nav.features}</a>
          <a href="#how-it-works" className="block text-muted hover:text-fg">{d.nav.howItWorks}</a>
          <a href="#practice" className="block text-muted hover:text-fg">{d.landing.practiceTitle}</a>
        </div>
        <div className="space-y-2.5 text-sm">
          <p className="font-medium">{d.common.brand}</p>
          <Link to="/login" className="block text-muted hover:text-fg">{d.common.login}</Link>
          <Link to="/register" className="block text-muted hover:text-fg">{d.common.getStarted}</Link>
        </div>
      </div>
      <div className="border-t border-border">
        <p className="mx-auto max-w-6xl px-4 py-6 text-[13px] text-subtle sm:px-6">
          © {new Date().getFullYear()} {d.landing.footerRights}
        </p>
      </div>
    </footer>
  );
}

export default function Landing() {
  return (
    <div className="min-h-dvh overflow-x-clip bg-bg">
      <Header />
      <main>
        <Hero />
        <Features />
        <HowItWorks />
        <Practice />
        <ExampleEvaluation />
        <CTA />
      </main>
      <Footer />
    </div>
  );
}
