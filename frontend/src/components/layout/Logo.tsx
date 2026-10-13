import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";

/** Neutral mark: three voice bars on an ink square. Adapts to light/dark through the ink token. */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={cn("size-6", className)} aria-hidden>
      <rect width="24" height="24" rx="6" className="fill-ink" />
      <g className="fill-ink-fg">
        <rect x="6.5" y="9.5" width="2" height="5" rx="1" />
        <rect x="11" y="6.5" width="2" height="11" rx="1" />
        <rect x="15.5" y="8.5" width="2" height="7" rx="1" />
      </g>
    </svg>
  );
}

export function Logo({ to = "/", className }: { to?: string; className?: string }) {
  return (
    <Link to={to} className={cn("flex items-center gap-2 text-fg", className)} dir="ltr">
      <LogoMark />
      <span className="text-[15px] font-semibold tracking-[-0.01em]">SmartInterview</span>
    </Link>
  );
}
