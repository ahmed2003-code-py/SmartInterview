import { useState, type FormEvent, type ReactNode } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { Logo } from "@/components/layout/Logo";
import { LanguageSwitch, ThemeToggle } from "@/components/layout/Preferences";
import { useI18n } from "@/i18n";
import { useAuth } from "@/lib/auth";
import { ApiError } from "@/lib/api";
import { Check } from "lucide-react";
import { m, fadeUp, stagger } from "@/lib/motion";

function AuthShell({ title, subtitle, children, footer }: { title: string; subtitle: string; children: ReactNode; footer: ReactNode }) {
  const { d } = useI18n();
  return (
    <div className="grid min-h-dvh bg-bg lg:grid-cols-[1fr_minmax(0,0.9fr)]">
      <div className="flex min-h-dvh flex-col">
        <header className="flex h-14 items-center justify-between px-4 sm:px-6">
          <Logo />
          <div className="flex items-center gap-1">
            <LanguageSwitch />
            <ThemeToggle />
          </div>
        </header>
        <main className="flex flex-1 flex-col items-center justify-center px-4 pt-6 pb-16">
          <m.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-[24rem]">
            <h1 className="t-page">{title}</h1>
            <p className="mt-2 text-muted">{subtitle}</p>
            <div className="mt-8">{children}</div>
            <p className="mt-8 text-center text-sm text-muted">{footer}</p>
          </m.div>
        </main>
      </div>

      {/* Desktop: what you get, on the brand surface */}
      <aside className="relative hidden overflow-hidden bg-ink text-ink-fg lg:flex lg:flex-col lg:justify-end lg:p-12">
        <div className="dot-grid absolute inset-0 opacity-[0.15] invert dark:invert-0" />
        <div className="ai-gradient pointer-events-none absolute -top-32 -end-32 size-96 rounded-full opacity-35 blur-3xl" />
        <m.div initial="hidden" animate="show" variants={stagger(0.08, 0.15)} className="relative max-w-md">
          <m.div variants={fadeUp} className="flex items-end gap-1.5" aria-hidden>
            {[10, 18, 13, 24, 16, 30, 20].map((h, i) => (
              <span key={i} className="ai-gradient w-2 rounded-full animate-speak-bar" style={{ height: h * 1.6, animationDelay: `${i * 0.12}s` }} />
            ))}
          </m.div>
          <m.h2 variants={fadeUp} className="t-display mt-8">
            {d.auth.asideTitle}
          </m.h2>
          <ul className="mt-6 space-y-3">
            {d.auth.asidePoints.map((p) => (
              <m.li key={p} variants={fadeUp} className="flex items-center gap-3 text-[15px] opacity-85">
                <span className="grid size-5 place-items-center rounded-full bg-ink-fg/10">
                  <Check className="size-3" strokeWidth={3} />
                </span>
                {p}
              </m.li>
            ))}
          </ul>
        </m.div>
      </aside>
    </div>
  );
}

function useErrorMessage() {
  const { d } = useI18n();
  return (err: unknown) => {
    if (err instanceof ApiError) {
      if (err.code === "INVALID_CREDENTIALS" || err.code === "EMAIL_TAKEN") return d.auth.errors[err.code];
      if (err.code === "NETWORK_ERROR") return d.room.errors.network;
    }
    return d.room.errors.generic;
  };
}

export function LoginPage() {
  const { d } = useI18n();
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const toMessage = useErrorMessage();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await login(email, password);
      navigate((location.state as { from?: string } | null)?.from ?? "/dashboard", { replace: true });
    } catch (err) {
      setError(toMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthShell
      title={d.auth.loginTitle}
      subtitle={d.auth.loginSubtitle}
      footer={
        <>
          {d.auth.noAccount}{" "}
          <Link to="/register" className="font-medium text-fg underline decoration-border-strong underline-offset-4 hover:decoration-fg">
            {d.auth.signUp}
          </Link>
        </>
      }
    >
      <form onSubmit={onSubmit} className="space-y-5" noValidate>
        <Field label={d.auth.email} htmlFor="email">
          <Input id="email" type="email" autoComplete="email" dir="ltr" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </Field>
        <Field label={d.auth.password} htmlFor="password">
          <Input id="password" type="password" autoComplete="current-password" dir="ltr" required value={password} onChange={(e) => setPassword(e.target.value)} />
        </Field>
        {error && <p className="animate-pop-in rounded-xl bg-danger-soft px-3 py-2.5 text-sm text-danger" role="alert">{error}</p>}
        <Button type="submit" size="lg" className="w-full" loading={busy}>
          {d.auth.loginCta}
        </Button>
      </form>
    </AuthShell>
  );
}

export function RegisterPage() {
  const { d } = useI18n();
  const { register } = useAuth();
  const navigate = useNavigate();
  const toMessage = useErrorMessage();
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [errors, setErrors] = useState<Partial<Record<keyof typeof form, string>>>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm((f) => ({ ...f, [k]: e.target.value }));

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const next: typeof errors = {};
    if (form.name.trim().length < 2) next.name = d.auth.errors.nameShort;
    if (!/^\S+@\S+\.\S+$/.test(form.email.trim())) next.email = d.auth.errors.emailInvalid;
    if (form.password.length < 8) next.password = d.auth.errors.passwordShort;
    setErrors(next);
    setError(null);
    if (Object.keys(next).length) return;
    setBusy(true);
    try {
      await register(form.name.trim(), form.email.trim(), form.password);
      navigate("/dashboard", { replace: true });
    } catch (err) {
      setError(toMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthShell
      title={d.auth.registerTitle}
      subtitle={d.auth.registerSubtitle}
      footer={
        <>
          {d.auth.haveAccount}{" "}
          <Link to="/login" className="font-medium text-fg underline decoration-border-strong underline-offset-4 hover:decoration-fg">
            {d.common.login}
          </Link>
        </>
      }
    >
      <form onSubmit={onSubmit} className="space-y-5" noValidate>
        <Field label={d.auth.name} htmlFor="name" error={errors.name}>
          <Input id="name" autoComplete="name" value={form.name} onChange={set("name")} aria-invalid={!!errors.name} />
        </Field>
        <Field label={d.auth.email} htmlFor="email" error={errors.email}>
          <Input id="email" type="email" autoComplete="email" dir="ltr" value={form.email} onChange={set("email")} aria-invalid={!!errors.email} />
        </Field>
        <Field label={d.auth.password} htmlFor="password" hint={d.auth.passwordHint} error={errors.password}>
          <Input id="password" type="password" autoComplete="new-password" dir="ltr" value={form.password} onChange={set("password")} aria-invalid={!!errors.password} />
        </Field>
        {error && <p className="animate-pop-in rounded-xl bg-danger-soft px-3 py-2.5 text-sm text-danger" role="alert">{error}</p>}
        <Button type="submit" size="lg" className="w-full" loading={busy}>
          {d.auth.registerCta}
        </Button>
      </form>
    </AuthShell>
  );
}
