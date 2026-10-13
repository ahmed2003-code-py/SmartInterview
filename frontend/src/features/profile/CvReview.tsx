import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Check, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { TagEditor } from "./TagEditor";
import { api, type CvProposal, type EducationItem, type ExperienceItem, type ProjectItem, type User } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/i18n";
import { cn } from "@/lib/utils";

const SCALARS = ["name", "headline", "currentRole", "targetRole", "specialization", "experienceLevel"] as const;
const TAGS = ["skills", "certifications", "languages"] as const;
const ITEMS = ["experience", "education", "projects"] as const;
type Item = EducationItem | ExperienceItem | ProjectItem;

const itemTitle = (k: (typeof ITEMS)[number], x: Item) => {
  if (k === "education") {
    const e = x as EducationItem;
    return [e.degree, e.field].filter(Boolean).join(" · ");
  }
  if (k === "experience") return (x as ExperienceItem).title ?? (x as ExperienceItem).organization ?? "";
  return (x as ProjectItem).name ?? "";
};
const itemSub = (k: (typeof ITEMS)[number], x: Item) => {
  if (k === "education") return [(x as EducationItem).institution, (x as EducationItem).years].filter(Boolean).join(" · ");
  if (k === "experience") return [(x as ExperienceItem).organization, (x as ExperienceItem).period].filter(Boolean).join(" · ");
  return (x as ProjectItem).summary ?? "";
};

/**
 * "We found this in your CV": the user decides, field by field. Empty profile fields default to the CV;
 * existing values default to "keep". Values can be edited, list items removed. Nothing is saved until Apply.
 */
export function CvReview({ proposal, open, onClose }: { proposal: CvProposal; open: boolean; onClose: () => void }) {
  const { d } = useI18n();
  const { setUser } = useAuth();
  const [busy, setBusy] = useState(false);
  const label = (k: string) =>
    ({ name: d.profile.name, headline: d.profile.headline, currentRole: d.background.currentRole, targetRole: d.profile.targetRole, specialization: d.profile.specialization, experienceLevel: d.profile.experience })[k] ??
    d.background[k as keyof typeof d.background];

  const [scalars, setScalars] = useState(() =>
    Object.fromEntries(
      SCALARS.filter((k) => proposal[k]).map((k) => {
        const p = proposal[k]!;
        return [k, { include: p.use === "cv", value: String(p.use === "cv" ? p.fromCv : (p.current ?? "")) }];
      }),
    ) as Record<string, { include: boolean; value: string }>,
  );
  const [tags, setTags] = useState(() =>
    Object.fromEntries(TAGS.filter((k) => proposal[k]).map((k) => [k, (proposal[k]!.use === "cv" ? proposal[k]!.fromCv : proposal[k]!.current) as string[]])) as Record<string, string[]>,
  );
  const [picked, setPicked] = useState(() =>
    Object.fromEntries(ITEMS.filter((k) => proposal[k]).map((k) => [k, (proposal[k]!.fromCv as Item[]).map(() => proposal[k]!.use === "cv")])) as Record<string, boolean[]>,
  );

  const empty = useMemo(() => Object.keys(proposal).length === 0, [proposal]);

  async function apply() {
    const patch: Record<string, unknown> = {};
    for (const [k, s] of Object.entries(scalars)) {
      if (!s.include) continue;
      const v = s.value.trim();
      if (k === "name" && v.length < 2) continue;
      patch[k] = k === "experienceLevel" ? (v || null) : v;
    }
    for (const [k, list] of Object.entries(tags)) patch[k] = list;
    for (const [k, flags] of Object.entries(picked)) {
      const cur = (proposal[k]!.current as Item[]) ?? [];
      const add = (proposal[k]!.fromCv as Item[]).filter((_, i) => flags[i]);
      const seen = new Set(cur.map((x) => JSON.stringify(x)));
      patch[k] = [...cur, ...add.filter((x) => !seen.has(JSON.stringify(x)))];
    }
    setBusy(true);
    try {
      setUser((await api.patch<{ user: User }>("/profile", patch)).user);
      toast.success(d.profileCv.applied);
      onClose();
    } catch {
      toast.error(d.profile.saveFailed);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent title={d.profileCv.reviewTitle} description={empty ? d.profileCv.nothingNew : d.profileCv.reviewBody} className="flex max-h-[88dvh] max-w-2xl flex-col">
        <div className="-mx-6 mt-5 min-h-0 flex-1 space-y-5 overflow-y-auto border-y border-border px-6 py-5">
          {Object.entries(scalars).map(([k, s]) => {
            const p = proposal[k]!;
            const hasCurrent = p.current != null && p.current !== "";
            const display = (v: unknown) => (k === "experienceLevel" ? d.profile.levels[v as keyof typeof d.profile.levels] : String(v));
            return (
              <div key={k}>
                <p className="t-label mb-2">{label(k)}</p>
                {hasCurrent ? (
                  <div role="radiogroup" aria-label={label(k)} className="grid gap-2 sm:grid-cols-2">
                    {[
                      { on: !s.include, title: d.profileCv.keep, value: p.current, pick: () => setScalars((x) => ({ ...x, [k]: { include: false, value: String(p.current) } })) },
                      { on: s.include, title: d.profileCv.useCv, value: p.fromCv, pick: () => setScalars((x) => ({ ...x, [k]: { include: true, value: String(p.fromCv) } })) },
                    ].map((o) => (
                      <button
                        key={o.title}
                        type="button"
                        role="radio"
                        aria-checked={o.on}
                        onClick={o.pick}
                        className={cn("rounded-xl border px-3 py-2.5 text-start transition-colors", o.on ? "border-primary bg-primary-soft/50" : "border-border hover:border-border-strong")}
                      >
                        <span className="t-caption block">{o.title}</span>
                        <span className="mt-0.5 block truncate text-sm font-medium" dir="auto">
                          {display(o.value)}
                        </span>
                      </button>
                    ))}
                  </div>
                ) : k === "experienceLevel" ? (
                  <label className="flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={s.include} onChange={(e) => setScalars((x) => ({ ...x, [k]: { ...s, include: e.target.checked } }))} className="size-4 accent-[var(--primary)]" />
                    {display(p.fromCv)}
                  </label>
                ) : (
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      aria-label={label(k)}
                      checked={s.include}
                      onChange={(e) => setScalars((x) => ({ ...x, [k]: { ...s, include: e.target.checked } }))}
                      className="size-4 shrink-0 accent-[var(--primary)]"
                    />
                    <Input value={s.value} maxLength={k === "headline" ? 120 : 80} onChange={(e) => setScalars((x) => ({ ...x, [k]: { include: true, value: e.target.value } }))} dir="auto" className={cn("h-10", !s.include && "opacity-50")} />
                  </div>
                )}
                {hasCurrent && s.include && k !== "experienceLevel" && (
                  <Input value={s.value} maxLength={k === "headline" ? 120 : 80} onChange={(e) => setScalars((x) => ({ ...x, [k]: { include: true, value: e.target.value } }))} dir="auto" className="mt-2 h-10" />
                )}
              </div>
            );
          })}

          {Object.entries(tags).map(([k, list]) => {
            const fromCv = proposal[k]!.fromCv as string[];
            const suggestions = fromCv.filter((t) => !list.some((x) => x.toLowerCase() === t.toLowerCase()));
            return (
              <div key={k}>
                <p className="t-label mb-2">{label(k)}</p>
                <TagEditor items={list} onChange={(v) => setTags((x) => ({ ...x, [k]: v }))} removeLabel={d.background.removeItem} />
                {suggestions.length > 0 && (
                  <div className="mt-2 flex flex-wrap items-center gap-1.5">
                    <span className="t-caption">{d.profileCv.fromCv}:</span>
                    {suggestions.map((t) => (
                      <button key={t} type="button" onClick={() => setTags((x) => ({ ...x, [k]: [...list, t] }))} className="inline-flex items-center gap-1 rounded-full border border-dashed border-primary/40 px-2.5 py-0.5 text-[13px] text-primary-soft-fg hover:bg-primary-soft/50" dir="auto">
                        <Plus className="size-3" />
                        {t}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            );
          })}

          {Object.entries(picked).map(([k, flags]) => (
            <div key={k}>
              <p className="t-label mb-2">{label(k)}</p>
              <ul className="space-y-1.5">
                {(proposal[k]!.fromCv as Item[]).map((x, i) => (
                  <li key={i}>
                    <label className={cn("flex cursor-pointer items-start gap-3 rounded-xl border px-3 py-2.5 transition-colors", flags[i] ? "border-primary/40 bg-primary-soft/30" : "border-border")}>
                      <input
                        type="checkbox"
                        checked={flags[i]}
                        onChange={(e) => setPicked((p) => ({ ...p, [k]: p[k].map((f, j) => (j === i ? e.target.checked : f)) }))}
                        className="mt-0.5 size-4 shrink-0 accent-[var(--primary)]"
                      />
                      <span className="min-w-0">
                        <span className="block text-sm font-medium" dir="auto">
                          {itemTitle(k as (typeof ITEMS)[number], x)}
                        </span>
                        {itemSub(k as (typeof ITEMS)[number], x) && (
                          <span className="t-caption block" dir="auto">
                            {itemSub(k as (typeof ITEMS)[number], x)}
                          </span>
                        )}
                      </span>
                    </label>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            {d.profileCv.later}
          </Button>
          {!empty && (
            <Button onClick={apply} loading={busy}>
              {!busy && <Check className="size-4" />}
              {d.profileCv.apply}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
