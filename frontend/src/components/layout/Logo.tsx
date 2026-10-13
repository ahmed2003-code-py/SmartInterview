import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";

export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={cn("size-7", className)} aria-hidden>
      <rect width="32" height="32" rx="8" className="fill-primary" />
      <g fill="#fff">
        <rect x="8" y="12" width="3" height="8" rx="1.5" />
        <rect x="14.5" y="8" width="3" height="16" rx="1.5" />
        <rect x="21" y="11" width="3" height="10" rx="1.5" />
      </g>
    </svg>
  );
}

export function Logo({ to = "/", className }: { to?: string; className?: string }) {
  return (
    <Link to={to} className={cn("flex items-center gap-2.5 font-semibold tracking-tight text-fg", className)} dir="ltr">
      <LogoMark />
      <span className="text-[15px]">
        Smart<span className="text-primary">Interview</span>
      </span>
    </Link>
  );
}
