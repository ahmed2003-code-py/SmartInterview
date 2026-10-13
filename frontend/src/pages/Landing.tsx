import { Link } from "react-router-dom";
import { ArrowRight, Check, CircleDot, Menu as MenuIcon, MessagesSquare, Mic, Plus, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/layout/Logo";
import { LanguageSwitch, ThemeToggle } from "@/components/layout/Preferences";
import { Menu, MenuContent, MenuItem, MenuSeparator, MenuTrigger } from "@/components/ui/dropdown";
import { Skeleton } from "@/components/ui/skeleton";
import { InterviewDemo } from "@/features/landing/InterviewDemo";
import { ScoreBars } from "@/features/report/ScoreBars";
import { ScoreRing } from "@/features/viz/ScoreRing";
import { useI18n } from "@/i18n";
import { useAuth } from "@/lib/auth";
import { useFetch } from "@/hooks/useFetch";
import { api, type Role } from "@/lib/api";
import { Reveal, m, fadeUp, stagger } from "@/lib/motion";

function Header() {
  const { d } = useI18n();
  const { user } = useAuth();
  const links = [
    { href: "#how-it-works", label: d.nav.howItWorks },
    { href: "#report", label: d.nav.report },
    { href: "#roles", label: d.nav.roles },
  ];
  return (
    <header className="sticky top-0 z-40 border-b border-border/60 bg-bg/80 backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-6xl items-center gap-8 px-4 sm:px-6">
        <Logo />
        <nav className="hidden items-center gap-6 md:flex">
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
              <Button variant="ghost" size="icon" className="md:hidden" aria-label={d.nav.menu}>
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

function SectionTitle({ eyebrow, title, body, className, center }: { eyebrow: string; title: string; body?: string; className?: string; center?: boolean }) {
  return (
    <Reveal className={className}>
      <p className="t-eyebrow">{eyebrow}</p>
      <h2 className={`t-display mt-3 text-balance ${center ? "mx-auto max-w-2xl" : "max-w-xl"}`}>{title}</h2>
      {body && <p className={`mt-4 text-[16px] leading-relaxed text-muted ${center ? "mx-auto max-w-lg" : "max-w-lg"}`}>{body}</p>}
    </Reveal>
  );
}

function Hero() {
  const { d } = useI18n();
  return (
    <section id="top" className="relative overflow-hidden">
      <div className="dot-grid pointer-events-none absolute inset-0 [mask-image:radial-gradient(ellipse_at_top,black_20%,transparent_70%)]" />
      <div className="relative mx-auto grid max-w-6xl items-center gap-14 px-4 pt-12 pb-20 sm:px-6 sm:pt-20 lg:grid-cols-[1.05fr_1fr] lg:gap-10 lg:pt-24 lg:pb-28">
        <m.div initial="hidden" animate="show" variants={stagger(0.08)}>
          <m.p variants={fadeUp} className="inline-flex items-center gap-2 rounded-full border border-border bg-surface/70 py-1 ps-1.5 pe-3 text-[12.5px] font-medium text-muted shadow-sm backdrop-blur">
            <span className="ai-gradient grid size-5 place-items-center rounded-full text-white">
              <Sparkles className="size-3" />
            </span>
            {d.landing.heroEyebrow}
          </m.p>
          <h1 className="t-hero mt-6">
            {d.landing.heroTitle.map((w, i) => (
              <m.span key={w} variants={fadeUp} className={`block ${i === 2 ? "ai-text pb-1" : ""}`}>
                {w}
              </m.span>
            ))}
          </h1>
          <m.p variants={fadeUp} className="mt-6 max-w-[34rem] text-[17px] leading-relaxed text-muted">
            {d.landing.heroSubtitle}
          </m.p>
          <m.div variants={fadeUp} className="mt-8 flex flex-wrap items-center gap-3">
            <Button asChild size="lg">
              <Link to="/register">
                {d.common.startPracticing}
                <ArrowRight className="size-4 rtl:-scale-x-100" />
              </Link>
            </Button>
            <Button asChild size="lg" variant="ghost" className="text-fg">
              <a href="#how-it-works">{d.nav.howItWorks}</a>
            </Button>
          </m.div>
          <m.p variants={fadeUp} className="mt-6 text-[13px] text-subtle">
            {d.landing.heroNote}
          </m.p>
        </m.div>
        <m.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.2 }} className="pb-6">
          <InterviewDemo />
        </m.div>
      </div>
    </section>
  );
}

function HowItWorks() {
  const { d } = useI18n();
  const icons = [Mic, MessagesSquare, Sparkles];
  return (
    <section id="how-it-works" className="border-t border-border bg-bg-subtle">
      <div className="mx-auto max-w-6xl px-4 py-24 sm:px-6 lg:py-28">
        <SectionTitle eyebrow={d.landing.howEyebrow} title={d.landing.howTitle} />
        <m.ol initial="hidden" whileInView="show" viewport={{ once: true, margin: "-10% 0px" }} variants={stagger(0.1)} className="mt-14 grid gap-4 md:grid-cols-3">
          {d.landing.steps.map((s, i) => {
            const Icon = icons[i];
            return (
              <m.li key={s.title} variants={fadeUp} className="relative rounded-2xl border border-border bg-surface p-6">
                <div className="flex items-center justify-between">
                  <span className="grid size-10 place-items-center rounded-xl bg-primary-soft text-primary">
                    <Icon className="size-5" />
                  </span>
                  <span className="text-[13px] font-semibold text-subtle tabular-nums">0{i + 1}</span>
                </div>
                <h3 className="mt-6 text-lg font-semibold tracking-[-0.02em]">{s.title}</h3>
                <p className="mt-2 text-[15px] leading-relaxed text-muted">{s.body}</p>
              </m.li>
            );
          })}
        </m.ol>
      </div>
    </section>
  );
}

function ReportPreview() {
  const { d } = useI18n();
  return (
    <section id="report" className="mx-auto max-w-6xl px-4 py-24 sm:px-6 lg:py-28">
      <div className="grid items-center gap-14 lg:grid-cols-[0.9fr_1.1fr] lg:gap-16">
        <SectionTitle eyebrow={d.landing.exampleEyebrow} title={d.landing.exampleTitle} body={d.landing.exampleBody} />
        <Reveal className="relative rounded-2xl border border-border bg-surface p-5 shadow-lg sm:p-7" aria-hidden>
          <span className="absolute top-4 end-4 rounded-full bg-surface-2 px-2 py-0.5 text-[11px] font-medium text-subtle">{d.common.sample}</span>
          <div className="flex flex-col items-center gap-6 border-b border-border pb-6 sm:flex-row sm:items-center">
            <ScoreRing score={82} size={120} stroke={8} />
            <div className="text-center sm:text-start">
              <p className="t-eyebrow">{d.report.title}</p>
              <p className="mt-1.5 text-xl font-semibold tracking-[-0.02em]">{d.landing.exampleRole}</p>
              <p className="mt-1 text-sm font-semibold text-success">{d.report.bandsLong.good}</p>
            </div>
          </div>
          <ScoreBars className="mt-6" compact scores={{ communication: 86, clarity: 80, relevance: 88, subjectKnowledge: 78, educationalReasoning: 64 }} />
          <div className="mt-6 grid gap-3 border-t border-border pt-5 text-sm sm:grid-cols-3">
            {[
              { icon: <Check className="size-4" strokeWidth={2.5} />, tone: "text-success", label: d.report.strengths, text: d.landing.exampleStrength },
              { icon: <CircleDot className="size-4" />, tone: "text-warning", label: d.report.improvements, text: d.landing.exampleImprove },
              { icon: <ArrowRight className="size-4 rtl:-scale-x-100" />, tone: "text-primary", label: d.report.practice, text: d.landing.exampleNext },
            ].map((x) => (
              <div key={x.label}>
                <p className={`flex items-center gap-1.5 text-[13px] font-semibold ${x.tone}`}>
                  {x.icon}
                  {x.label}
                </p>
                <p className="mt-1 leading-relaxed text-muted">{x.text}</p>
              </div>
            ))}
          </div>
        </Reveal>
      </div>
    </section>
  );
}

function Roles() {
  const { d, lang } = useI18n();
  const { data, loading } = useFetch(() => api.get<{ roles: Role[] }>("/roles"), []);
  return (
    <section id="roles" className="border-t border-border">
      <div className="mx-auto max-w-6xl px-4 py-24 text-center sm:px-6 lg:py-28">
        <SectionTitle eyebrow={d.landing.rolesEyebrow} title={d.landing.rolesTitle} body={d.landing.rolesBody} center />
        <m.ul initial="hidden" whileInView="show" viewport={{ once: true }} variants={stagger(0.025)} className="mx-auto mt-12 flex max-w-4xl flex-wrap justify-center gap-2">
          {loading
            ? Array.from({ length: 10 }, (_, i) => (
                <li key={i}>
                  <Skeleton className="h-10 w-36 rounded-full" />
                </li>
              ))
            : data?.roles.map((r) => (
                <m.li key={r.id} variants={fadeUp}>
                  <Link to="/register" className="lift inline-flex h-10 items-center rounded-full border border-border bg-surface px-4 text-sm font-medium hover:border-primary/40">
                    {lang === "ar" ? r.nameAr : r.nameEn}
                  </Link>
                </m.li>
              ))}
          {!loading && (
            <m.li variants={fadeUp}>
              <Link to="/register" className="lift inline-flex h-10 items-center gap-1.5 rounded-full border border-dashed border-primary/50 bg-primary-soft/50 px-4 text-sm font-medium text-primary-soft-fg">
                <Plus className="size-4" />
                {d.landing.rolesYours}
              </Link>
            </m.li>
          )}
        </m.ul>
      </div>
    </section>
  );
}

function CTA() {
  const { d } = useI18n();
  return (
    <section className="px-4 pb-24 sm:px-6">
      <Reveal className="relative mx-auto max-w-6xl overflow-hidden rounded-3xl bg-ink px-6 py-14 text-ink-fg sm:px-12 sm:py-16">
        <div className="ai-gradient pointer-events-none absolute -end-24 -top-24 size-72 rounded-full opacity-40 blur-3xl" />
        <div className="relative flex flex-col items-start gap-8 md:flex-row md:items-end md:justify-between">
          <div>
            <h2 className="t-display max-w-xl text-balance">{d.landing.ctaTitle}</h2>
            <p className="mt-3 opacity-70">{d.landing.ctaBody}</p>
          </div>
          <Button asChild size="lg" className="bg-ink-fg text-ink shadow-none hover:bg-ink-fg/90">
            <Link to="/register">
              {d.common.startPracticing}
              <ArrowRight className="size-4 rtl:-scale-x-100" />
            </Link>
          </Button>
        </div>
      </Reveal>
    </section>
  );
}

function Footer() {
  const { d } = useI18n();
  return (
    <footer className="border-t border-border">
      <div className="mx-auto flex max-w-6xl flex-col gap-8 px-4 py-12 sm:px-6 md:flex-row md:justify-between">
        <div className="max-w-sm">
          <Logo />
          <p className="mt-4 text-sm leading-relaxed text-muted">{d.landing.footerAbout}</p>
        </div>
        <div className="flex gap-16 text-sm">
          <div className="space-y-2.5">
            <a href="#how-it-works" className="block text-muted hover:text-fg">
              {d.nav.howItWorks}
            </a>
            <a href="#report" className="block text-muted hover:text-fg">
              {d.nav.report}
            </a>
            <a href="#roles" className="block text-muted hover:text-fg">
              {d.nav.roles}
            </a>
          </div>
          <div className="space-y-2.5">
            <Link to="/login" className="block text-muted hover:text-fg">
              {d.common.login}
            </Link>
            <Link to="/register" className="block text-muted hover:text-fg">
              {d.common.getStarted}
            </Link>
          </div>
        </div>
      </div>
      <p className="mx-auto max-w-6xl px-4 pb-10 text-[13px] text-subtle sm:px-6">© 2026 {d.landing.footerRights}</p>
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
        <ReportPreview />
        <Roles />
        <CTA />
      </main>
      <Footer />
    </div>
  );
}
