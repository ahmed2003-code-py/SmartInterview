import * as D from "@radix-ui/react-dialog";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export const Dialog = D.Root;
export const DialogTrigger = D.Trigger;
export const DialogClose = D.Close;

export function DialogContent({ title, description, children, className }: { title: ReactNode; description?: ReactNode; children?: ReactNode; className?: string }) {
  return (
    <D.Portal>
      <D.Overlay className="fixed inset-0 z-50 bg-[#0c0b0a]/45 backdrop-blur-[2px] data-[state=open]:animate-fade-in" />
      <D.Content
        className={cn(
          "fixed left-1/2 top-1/2 z-50 w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-border bg-surface p-6 shadow-lg focus:outline-none data-[state=open]:animate-pop-in",
          className,
        )}
      >
        <D.Title className="text-lg font-semibold tracking-[-0.02em]">{title}</D.Title>
        {description && <D.Description className="mt-2 text-sm text-muted">{description}</D.Description>}
        {children}
      </D.Content>
    </D.Portal>
  );
}
