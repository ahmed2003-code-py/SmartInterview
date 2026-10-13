import { useState, type FormEvent, type ReactNode } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { Logo, LogoMark } from "@/components/layout/Logo";
import { LanguageSwitch, ThemeToggle } from "@/components/layout/Preferences";
import { Waveform } from "@/features/interview/Waveform";
import { useI18n } from "@/i18n";
import { useAuth } from "@/lib/auth";
import { ApiError } from "@/lib/api";

function AuthShell({ title, subtitle, children, footer }: { title: string; subtitle: string; children: ReactNode; footer: ReactNode }) {
  const { d } = useI18n();
  return (
    <div className="grid min-h-dvh bg-bg lg:grid-cols-[1fr_1fr]">
      <div className="flex flex-col px-4 py-5 sm:px-8">
        <div className="flex items-center justify-between">
          <Logo />
          <div className="flex items-center gap-1">
            <LanguageSwitch />
            <ThemeToggle />
          </div>
        </div>
        <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center py-12">
          <h1 className="text-[1.75rem] font-semibold tracking-tight">{title}</h1>
          <p className="mt-2 text-muted">{subtitle}</p>
          <div className="mt-8">{children}</div>
          <p className="mt-8 text-sm text-muted">{footer}</p>
        </div>
      </div>

      <aside className="relative hidden overflow-hidden bg-navy p-12 text-white lg:flex lg:flex-col lg:justify-center lg:gap-14 dark:border-s dark:border-border dark:bg-surface">
        <p className="max-w-md text-2xl leading-snug font-medium tracking-tight text-white/90">{d.auth.panelQuote}</p>
        <div className="max-w-md rounded-xl border border-white/10 bg-white/[0.04] p-6">
          <div className="flex items-center gap-3">
            <LogoMark className="size-9" />
            <div>
              <p className="text-sm font-medium">{d.room.interviewer}</p>
              <p className="text-xs text-white/55">{d.auth.panelQuestion}</p>
            </div>
          </div>
          <p className="mt-5 text-lg leading-snug">{d.auth.panelText}</p>
          <Waveform className="mt-6 h-6 text-[#8d98ff]" bars={32} active />
        </div>
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
          <Link to="/register" className="font-medium text-primary hover:underline">
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
        {error && <p className="rounded-md bg-danger-soft px-3 py-2.5 text-sm text-danger" role="alert">{error}</p>}
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
          <Link to="/login" className="font-medium text-primary hover:underline">
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
        {error && <p className="rounded-md bg-danger-soft px-3 py-2.5 text-sm text-danger" role="alert">{error}</p>}
        <Button type="submit" size="lg" className="w-full" loading={busy}>
          {d.auth.registerCta}
        </Button>
      </form>
    </AuthShell>
  );
}
