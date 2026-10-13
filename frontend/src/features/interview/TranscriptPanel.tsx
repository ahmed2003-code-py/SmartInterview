import { useEffect, useRef } from "react";
import type { QuestionDTO } from "@/lib/api";
import { useI18n } from "@/i18n";
import { cn } from "@/lib/utils";
import type { Phase } from "@/pages/InterviewRoom";

/** Live conversation log. Below the stage on mobile, a side panel on desktop. */
export function TranscriptPanel({ questions, phase, language, pending }: { questions: QuestionDTO[]; phase: Phase; language: "en" | "ar"; pending?: string | null }) {
  const { d } = useI18n();
  const listRef = useRef<HTMLDivElement>(null);
  const visible = phase === "READY" ? questions.filter((q) => q.answer) : questions;

  useEffect(() => {
    // Scroll the panel itself (not the page), so mobile users aren't pulled away from the controls.
    const el = listRef.current;
    if (el && el.scrollHeight > el.clientHeight) el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [visible.length, phase]);

  return (
    <aside className="flex flex-col border-t border-border bg-bg-subtle lg:min-h-0 lg:border-t-0 lg:border-s">
      <div className="flex h-12 shrink-0 items-center border-b border-border px-5">
        <h2 className="text-sm font-semibold">{d.room.transcript}</h2>
      </div>
      <div ref={listRef} className="flex-1 space-y-5 px-5 py-5 lg:overflow-y-auto">
        {visible.length === 0 ? (
          <p className="py-8 text-center text-sm text-subtle">{d.room.transcriptEmpty}</p>
        ) : (
          visible.map((q) => (
            <div key={q.id} className="space-y-3 animate-fade-up">
              <div>
                <p className="mb-1 flex items-center gap-2 text-xs font-medium text-primary">
                  {d.room.interviewer}
                  {q.kind === "FOLLOW_UP" && <span className="font-normal text-subtle">· {d.room.followUp}</span>}
                </p>
                <p className="text-sm leading-relaxed" dir="auto" lang={language}>
                  {q.text}
                </p>
              </div>
              {q.answer || pending ? (
                <div className={cn("rounded-lg border border-border bg-surface px-3.5 py-3", !q.answer && "opacity-70")}>
                  <p className="mb-1 text-xs font-medium">{d.room.you}</p>
                  <p className="text-sm leading-relaxed text-muted" dir="auto">
                    {q.answer?.transcript ?? pending}
                  </p>
                </div>
              ) : (
                <div className={cn("flex items-center gap-1 px-1", phase === "ANALYZING" ? "opacity-100" : "opacity-0")} aria-hidden>
                  {[0, 1, 2].map((i) => (
                    <span key={i} className="size-1.5 animate-pulse rounded-full bg-subtle" style={{ animationDelay: `${i * 0.15}s` }} />
                  ))}
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </aside>
  );
}
