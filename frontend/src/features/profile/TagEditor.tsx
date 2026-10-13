import { useState } from "react";
import { Plus, X } from "lucide-react";
import { cn } from "@/lib/utils";

/** Small chip list: remove with ×, optionally add by typing + Enter. */
export function TagEditor({ items, onChange, addLabel, removeLabel, max = 30, className }: { items: string[]; onChange: (v: string[]) => void; addLabel?: string; removeLabel: string; max?: number; className?: string }) {
  const [draft, setDraft] = useState("");
  const add = () => {
    const v = draft.replace(/\s+/g, " ").trim().slice(0, 60);
    if (v && !items.some((x) => x.toLowerCase() === v.toLowerCase()) && items.length < max) onChange([...items, v]);
    setDraft("");
  };
  return (
    <div className={cn("flex flex-wrap items-center gap-1.5", className)}>
      {items.map((t) => (
        <span key={t} className="inline-flex max-w-full items-center gap-1 rounded-full bg-surface-2 py-1 ps-2.5 pe-1 text-[13px] font-medium" dir="auto">
          <span className="truncate">{t}</span>
          <button type="button" onClick={() => onChange(items.filter((x) => x !== t))} aria-label={`${removeLabel}: ${t}`} className="grid size-5 shrink-0 place-items-center rounded-full text-subtle hover:bg-surface-3 hover:text-fg">
            <X className="size-3" />
          </button>
        </span>
      ))}
      {addLabel && items.length < max && (
        <span className="inline-flex items-center gap-1 rounded-full border border-dashed border-border-strong py-0.5 ps-2.5 pe-1 focus-within:border-primary">
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                add();
              }
            }}
            placeholder={addLabel}
            aria-label={addLabel}
            dir="auto"
            maxLength={60}
            className="w-28 bg-transparent text-[13px] outline-none placeholder:text-subtle"
          />
          <button type="button" onClick={add} aria-label={addLabel} className="grid size-5 place-items-center rounded-full text-subtle hover:bg-surface-2 hover:text-fg">
            <Plus className="size-3" />
          </button>
        </span>
      )}
    </div>
  );
}
