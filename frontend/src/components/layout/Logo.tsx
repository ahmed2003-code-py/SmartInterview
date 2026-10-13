import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";

/** The mark: a voice line that rises — speaking, and getting better — on the AI signal gradient. */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={cn("size-6", className)} aria-hidden>
      <defs>
        <linearGradient id="si-mark" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="var(--ai-1)" />
          <stop offset="1" stopColor="var(--ai-2)" />
        </linearGradient>
      </defs>
      <rect width="24" height="24" rx="7" fill="url(#si-mark)" />
      <g fill="#fff">
        <rect x="5.5" y="11" width="2.2" height="5" rx="1.1" />
        <rect x="9.4" y="8" width="2.2" height="8" rx="1.1" />
        <rect x="13.3" y="10" width="2.2" height="6" rx="1.1" />
        <rect x="17.2" y="6" width="2.2" height="10" rx="1.1" opacity="0.85" />
      </g>
    </svg>
  );
}

export function Logo({ to = "/", className }: { to?: string; className?: string }) {
  return (
    <Link to={to} className={cn("press flex items-center gap-2 text-fg", className)} dir="ltr">
      <LogoMark />
      <span className="text-[15px] font-semibold tracking-[-0.02em]">SmartInterview</span>
    </Link>
  );
}
