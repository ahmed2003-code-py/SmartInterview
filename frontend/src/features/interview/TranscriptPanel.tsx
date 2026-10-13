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
  const answered = questions.filter((q) => q.answer).length;

  useEffect(() => {
    // Scroll the panel itself (not the page), so mobile users aren't pulled away from the controls.
    const el = listRef.current;
    if (el && el.scrollHeight > el.clientHeight) el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [visible.length, phase]);

  return (
    <aside className="flex flex-col border-t border-border bg-surface lg:min-h-0 lg:border-t-0 lg:border-s">
      <div className="flex h-12 shrink-0 items-center justify-between border-b border-border px-5 sm:px-6">
        <h2 className="text-sm font-medium">{d.room.transcript}</h2>
        <span className="text-xs text-subtle tabular-nums">{answered}</span>
      </div>
      <div ref={listRef} className="flex-1 space-y-6 px-5 py-6 sm:px-6 lg:overflow-y-auto">
        {visible.length === 0 ? (
          <p className="py-8 text-center text-sm text-subtle">{d.room.transcriptEmpty}</p>
        ) : (
          visible.map((q, i) => (
            <div key={q.id} className="animate-fade-up">
              <p className="mb-1.5 text-xs text-subtle">
                <span className="tabular-nums">{i + 1}.</span> {d.room.interviewer}
                {q.kind === "FOLLOW_UP" && <span className="text-primary"> · {d.room.followUp}</span>}
              </p>
              <p className="text-[15px] leading-relaxed" dir="auto" lang={language}>
                {q.text}
              </p>
              {q.answer || pending ? (
                <div className={cn("mt-3 border-s-2 border-border-strong ps-3.5", !q.answer && "opacity-60")}>
                  <p className="mb-1 text-xs text-subtle">{d.room.you}</p>
                  <p className="text-sm leading-relaxed text-muted" dir="auto">
                    {q.answer?.transcript ?? pending}
                  </p>
                </div>
              ) : (
                phase === "ANALYZING" && (
                  <div className="mt-3 flex items-center gap-1 ps-1" aria-hidden>
                    {[0, 1, 2].map((k) => (
                      <span key={k} className="size-1.5 animate-pulse rounded-full bg-subtle" style={{ animationDelay: `${k * 0.15}s` }} />
                    ))}
                  </div>
                )
              )}
            </div>
          ))
        )}
      </div>
    </aside>
  );
}
