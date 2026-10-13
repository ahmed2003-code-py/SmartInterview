import { useId, useMemo, useRef, useState } from "react";
import { Check, CornerDownLeft, Search, X } from "lucide-react";
import type { Role } from "@/lib/api";
import { useI18n } from "@/i18n";
import { cn } from "@/lib/utils";

export interface RoleTarget {
  /** Suggested role id, or null for a role the student typed. */
  roleId: string | null;
  title: string;
}

type Option = { kind: "use"; title: string } | { kind: "role"; role: Role };

const norm = (s: string) => s.toLocaleLowerCase().replace(/\s+/g, " ").trim();

/**
 * Role picker that never limits the student: click → suggestions; type → filtered suggestions;
 * no exact match → "Use “typed value”". Full keyboard support (↑ ↓ Enter Esc) and combobox ARIA.
 */
export function RoleCombobox({ roles, value, onChange, loading }: { roles: Role[]; value: RoleTarget | null; onChange: (v: RoleTarget | null) => void; loading?: boolean }) {
  const { d, lang, fmt } = useI18n();
  const listId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState(value?.title ?? "");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);

  const name = (r: Role) => (lang === "ar" ? r.nameAr : r.nameEn);
  // While a selection is shown unchanged, the list shows all suggestions (not just the selected one).
  const q = value && query === value.title ? "" : norm(query);

  const { options, groups } = useMemo(() => {
    const match = (r: Role) => !q || norm(r.nameEn).includes(q) || norm(r.nameAr).includes(q);
    const edu = roles.filter((r) => (r.domain ?? "education") === "education" && match(r));
    const other = roles.filter((r) => r.domain === "general" && match(r));
    const exact = roles.some((r) => norm(r.nameEn) === q || norm(r.nameAr) === q);
    const use: Option[] = q && !exact ? [{ kind: "use", title: query.replace(/\s+/g, " ").trim().slice(0, 80) }] : [];
    const groups = [
      { label: d.setup.roleEducation, items: edu.map((role) => ({ kind: "role", role }) as Option) },
      { label: d.setup.roleOther, items: other.map((role) => ({ kind: "role", role }) as Option) },
    ].filter((g) => g.items.length);
    return { options: [...use, ...groups.flatMap((g) => g.items)], groups: { use, list: groups } };
  }, [roles, q, query, d.setup.roleEducation, d.setup.roleOther]);

  function choose(o: Option) {
    const next = o.kind === "use" ? { roleId: null, title: o.title } : { roleId: o.role.id, title: name(o.role) };
    onChange(next);
    setQuery(next.title);
    setOpen(false);
    inputRef.current?.blur();
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      if (!open) return setOpen(true);
      const n = options.length;
      if (n) setActive((a) => (a + (e.key === "ArrowDown" ? 1 : -1) + n) % n);
    } else if (e.key === "Enter") {
      if (open && options[active]) {
        e.preventDefault();
        choose(options[active]);
      }
    } else if (e.key === "Escape") {
      setOpen(false);
      if (value) setQuery(value.title);
    }
  }

  const optionId = (i: number) => `${listId}-${i}`;
  let index = 0;
  const renderOption = (o: Option) => {
    const i = index++;
    const selected = o.kind === "role" ? value?.roleId === o.role.id : false;
    return (
      <li
        key={o.kind === "use" ? "use" : o.role.id}
        id={optionId(i)}
        role="option"
        aria-selected={i === active}
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => choose(o)}
        onMouseMove={() => setActive(i)}
        className={cn("flex min-h-10 cursor-pointer items-center gap-2.5 rounded-lg px-3 py-2 text-sm", i === active && "bg-surface-2")}
      >
        {o.kind === "use" ? (
          <>
            <CornerDownLeft className="size-4 shrink-0 text-primary rtl:-scale-x-100" />
            <span className="min-w-0 flex-1 truncate font-medium" dir="auto">
              {fmt(d.setup.roleUse, { q: o.title })}
            </span>
          </>
        ) : (
          <>
            <span className="min-w-0 flex-1 truncate">{name(o.role)}</span>
            {selected && <Check className="size-4 shrink-0 text-primary" />}
          </>
        )}
      </li>
    );
  };

  return (
    <div className="relative">
      <div
        className={cn(
          "flex h-12 items-center gap-2.5 rounded-xl border bg-surface px-3.5 shadow-sm transition-[border-color,box-shadow]",
          open ? "border-primary ring-4 ring-primary/10" : value ? "border-border-strong" : "border-border-strong/80 hover:border-border-strong",
        )}
      >
        {value && !open ? <Check className="size-4 shrink-0 text-primary" /> : <Search className="size-4 shrink-0 text-subtle" />}
        <input
          ref={inputRef}
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={open && options[active] ? optionId(active) : undefined}
          aria-label={d.setup.role}
          value={query}
          placeholder={loading ? "…" : d.setup.rolePlaceholder}
          dir="auto"
          autoComplete="off"
          enterKeyHint="done"
          maxLength={80}
          onChange={(e) => {
            setQuery(e.target.value);
            setActive(0);
            setOpen(true);
            if (value && e.target.value !== value.title) onChange(null);
          }}
          onFocus={() => {
            setOpen(true);
            setActive(0);
          }}
          onBlur={() => {
            setOpen(false);
            // Leaving with typed text keeps it as a custom role, so nothing typed is lost.
            const t = query.replace(/\s+/g, " ").trim();
            if (!value && t) {
              const match = roles.find((r) => norm(r.nameEn) === norm(t) || norm(r.nameAr) === norm(t));
              onChange(match ? { roleId: match.id, title: name(match) } : { roleId: null, title: t.slice(0, 80) });
              if (match) setQuery(name(match));
            }
          }}
          onKeyDown={onKeyDown}
          className="h-full w-0 min-w-0 flex-1 bg-transparent text-base outline-none placeholder:text-subtle sm:text-[15px]"
        />
        {query && (
          <button
            type="button"
            aria-label={d.setup.roleChange}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => {
              setQuery("");
              onChange(null);
              inputRef.current?.focus();
            }}
            className="grid size-7 shrink-0 place-items-center rounded-md text-subtle transition-colors hover:bg-surface-2 hover:text-fg"
          >
            <X className="size-4" />
          </button>
        )}
      </div>

      {open && options.length > 0 && (
        <ul id={listId} role="listbox" aria-label={d.setup.role} className="scrollbar-none absolute inset-x-0 top-full z-30 mt-2 max-h-[min(20rem,50vh)] animate-pop-in overflow-y-auto rounded-xl border border-border bg-surface p-1.5 shadow-lg">
          {groups.use.map(renderOption)}
          {groups.list.map((g) => (
            <li key={g.label} role="presentation">
              <p className="px-3 pt-2.5 pb-1 text-[11.5px] font-semibold text-subtle">{g.label}</p>
              <ul role="presentation">{g.items.map(renderOption)}</ul>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
