import type { ReactNode } from "react";

/** Section with its title and hint on the side (desktop) or on top (mobile): scannable, no card stacks. */
export function SettingsSection({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <section className="grid gap-x-10 gap-y-5 border-t border-border py-8 first:border-t-0 first:pt-0 md:grid-cols-[minmax(0,15rem)_minmax(0,1fr)]">
      <div>
        <h2 className="t-section">{title}</h2>
        {hint && <p className="t-caption mt-1 max-w-xs">{hint}</p>}
      </div>
      <div className="min-w-0 space-y-5">{children}</div>
    </section>
  );
}

export function FieldRow({ label, htmlFor, children, hint }: { label: string; htmlFor?: string; children: ReactNode; hint?: string }) {
  return (
    <div>
      <label htmlFor={htmlFor} className="t-label mb-2 block">
        {label}
      </label>
      {children}
      {hint && <p className="t-caption mt-1.5">{hint}</p>}
    </div>
  );
}

