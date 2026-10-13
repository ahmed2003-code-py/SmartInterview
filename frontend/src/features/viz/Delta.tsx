import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import { cn } from "@/lib/utils";

/** Score change chip (+6 / −3 / 0). Only render it when the comparison is real. */
export function Delta({ value, className, title }: { value: number; className?: string; title?: string }) {
  const Icon = value > 0 ? ArrowUpRight : value < 0 ? ArrowDownRight : Minus;
  return (
    <span
      title={title}
      className={cn(
        "inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[11px] leading-none font-semibold tabular-nums",
        value > 0 ? "bg-success-soft text-success" : value < 0 ? "bg-warning-soft text-warning" : "bg-surface-2 text-muted",
        className,
      )}
      dir="ltr"
    >
      <Icon className="size-3" strokeWidth={2.5} />
      {value > 0 ? `+${value}` : value}
    </span>
  );
}
