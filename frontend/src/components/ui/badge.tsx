import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

const tones = {
  neutral: "bg-surface-2 text-muted",
  primary: "bg-primary-soft text-primary-soft-fg",
  success: "bg-success-soft text-success",
  warning: "bg-warning-soft text-warning",
  danger: "bg-danger-soft text-danger",
};

export function Badge({ tone = "neutral", className, ...props }: HTMLAttributes<HTMLSpanElement> & { tone?: keyof typeof tones }) {
  return <span className={cn("inline-flex items-center gap-1 rounded-sm px-1.5 py-0.5 text-xs font-medium whitespace-nowrap", tones[tone], className)} {...props} />;
}
