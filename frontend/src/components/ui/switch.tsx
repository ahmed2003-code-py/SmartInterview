import { cn } from "@/lib/utils";

/** Accessible on/off switch (role="switch"); mirrors correctly in RTL. */
export function Switch({ checked, onChange, label, disabled, id }: { checked: boolean; onChange: (v: boolean) => void; label: string; disabled?: boolean; id?: string }) {
  return (
    <button
      id={id}
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        "relative inline-flex h-6 w-11 shrink-0 items-center rounded-full p-0.5 transition-colors duration-200 outline-none focus-visible:ring-4 focus-visible:ring-primary/25 disabled:opacity-50",
        checked ? "bg-primary" : "bg-surface-3",
      )}
    >
      <span className={cn("size-5 rounded-full bg-white shadow-sm transition-transform duration-200", checked ? "translate-x-5 rtl:-translate-x-5" : "translate-x-0")} />
    </button>
  );
}
