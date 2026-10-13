import type { ReactNode } from "react";
import { AlertCircle } from "lucide-react";
import { Button } from "./button";
import { useI18n } from "@/i18n";
import { cn } from "@/lib/utils";

export function EmptyState({ title, body, action, className, icon }: { title: string; body?: string; action?: ReactNode; className?: string; icon?: ReactNode }) {
  return (
    <div className={cn("flex flex-col items-center px-6 py-14 text-center", className)}>
      {icon && <div className="mb-4 grid size-11 place-items-center rounded-xl border border-border bg-surface text-muted shadow-sm [&_svg]:size-5">{icon}</div>}
      <h3 className="text-lg font-semibold tracking-[-0.02em]">{title}</h3>
      {body && <p className="mt-1.5 max-w-sm text-sm text-muted">{body}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function ErrorState({ message, onRetry, className }: { message?: string; onRetry?: () => void; className?: string }) {
  const { d } = useI18n();
  return (
    <div className={cn("flex flex-col items-center px-6 py-14 text-center", className)}>
      <AlertCircle className="mb-3 size-6 text-danger" />
      <p className="max-w-sm text-sm text-muted">{message ?? d.room.errors.generic}</p>
      {onRetry && (
        <Button variant="secondary" size="sm" className="mt-4" onClick={onRetry}>
          {d.common.retry}
        </Button>
      )}
    </div>
  );
}
