import { useLayoutEffect, useRef, useState } from "react";
import { useI18n } from "@/i18n";
import { cn, textDir } from "@/lib/utils";

/**
 * Long text shown with a height limit and "Show more / Show less". Presentation only: the full
 * text is always in the DOM (and in the report), it is just visually clamped.
 */
export function ExpandableText({ text, lines = 6, className }: { text: string; lines?: number; className?: string }) {
  const { d } = useI18n();
  const ref = useRef<HTMLParagraphElement>(null);
  const [open, setOpen] = useState(false);
  const [overflows, setOverflows] = useState(false);

  useLayoutEffect(() => {
    const el = ref.current;
    if (el && !open) setOverflows(el.scrollHeight > el.clientHeight + 2);
  }, [text, open, lines]);

  return (
    <div>
      <p
        ref={ref}
        dir={textDir(text)}
        className={cn("whitespace-pre-wrap", className)}
        style={open ? undefined : { display: "-webkit-box", WebkitBoxOrient: "vertical", WebkitLineClamp: lines, overflow: "hidden" }}
      >
        {text}
      </p>
      {(overflows || open) && (
        <button type="button" onClick={() => setOpen((o) => !o)} className="mt-1.5 text-[13px] font-medium text-muted hover:text-fg" aria-expanded={open}>
          {open ? d.room.showLess : d.room.showMore}
        </button>
      )}
    </div>
  );
}
