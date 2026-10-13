import { useRef } from "react";
import { useNavigate } from "react-router-dom";
import { FileUp, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";
import { usePreferences } from "@/lib/preferences";
import { useI18n } from "@/i18n";
import { m } from "@/lib/motion";
import { useProfileCv } from "./useProfileCv";

/**
 * Optional first-run nudge: only for a mostly empty profile without a CV, and never again once dismissed.
 */
export function CvPrompt() {
  const { d } = useI18n();
  const { user } = useAuth();
  const { prefs, save } = usePreferences();
  const { upload, busy } = useProfileCv();
  const navigate = useNavigate();
  const input = useRef<HTMLInputElement>(null);

  const mostlyEmpty = user && !user.headline && !user.targetRole && !user.currentRole && user.skills.length === 0;
  if (!user || user.cv || prefs.cvPromptDismissed || !mostlyEmpty) return null;

  return (
    <m.section initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="relative mt-6 overflow-hidden rounded-2xl border border-primary/20 bg-primary-soft/40 p-5 sm:p-6" aria-labelledby="cv-prompt-title">
      <button
        type="button"
        onClick={() => save({ cvPromptDismissed: true }, { silent: true })}
        aria-label={d.profileCv.promptLater}
        className="absolute end-3 top-3 grid size-8 place-items-center rounded-lg text-subtle hover:bg-surface hover:text-fg"
      >
        <X className="size-4" />
      </button>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:gap-5">
        <span className="ai-gradient grid size-11 shrink-0 place-items-center rounded-xl text-white shadow-sm">
          <FileUp className="size-5" />
        </span>
        <div className="min-w-0 flex-1 pe-6">
          <h2 id="cv-prompt-title" className="t-section">
            {d.profileCv.promptTitle}
          </h2>
          <p className="mt-1 text-sm text-muted">{d.profileCv.promptBody}</p>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          <input
            ref={input}
            type="file"
            accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            className="sr-only"
            tabIndex={-1}
            aria-label={d.profileCv.upload}
            onChange={async (e) => {
              const f = e.target.files?.[0];
              e.target.value = "";
              if (!f) return;
              const review = await upload(f);
              if (review) navigate("/profile?review=1");
            }}
          />
          <Button onClick={() => input.current?.click()} loading={busy === "upload"}>
            {busy === "upload" ? d.profileCv.reading : d.profileCv.upload}
          </Button>
          <Button variant="ghost" onClick={() => save({ cvPromptDismissed: true }, { silent: true })}>
            {d.profileCv.promptLater}
          </Button>
        </div>
      </div>
    </m.section>
  );
}
