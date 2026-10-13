import { m } from "@/lib/motion";
import { cn } from "@/lib/utils";

/** Segmented control with a sliding selection pill. */
export function Segmented<T extends string>({ value, onChange, options, label, id, className }: { value: T; onChange: (v: T) => void; options: { value: T; label: string }[]; label: string; id: string; className?: string }) {
  return (
    <div role="radiogroup" aria-label={label} className={cn("grid w-full auto-cols-fr grid-flow-col rounded-xl bg-surface-2 p-1 sm:inline-grid sm:w-auto", className)}>
      {options.map((o) => {
        const on = value === o.value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => onChange(o.value)}
            className={cn("relative h-9 rounded-lg px-3 text-sm whitespace-nowrap sm:px-4 transition-colors outline-none focus-visible:ring-3 focus-visible:ring-primary/25", on ? "font-medium text-fg" : "text-muted hover:text-fg")}
          >
            {on && <m.span layoutId={`seg-${id}`} className="absolute inset-0 rounded-lg bg-surface shadow-sm ring-1 ring-border" transition={{ type: "spring", bounce: 0.15, duration: 0.35 }} />}
            <span className="relative">{o.label}</span>
          </button>
        );
      })}
    </div>
  );
}

