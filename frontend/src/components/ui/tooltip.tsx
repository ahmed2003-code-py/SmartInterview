import * as T from "@radix-ui/react-tooltip";
import type { ReactNode } from "react";

export const TooltipProvider = T.Provider;

export function Tooltip({ content, children }: { content: ReactNode; children: ReactNode }) {
  return (
    <T.Root delayDuration={300}>
      <T.Trigger asChild>{children}</T.Trigger>
      <T.Portal>
        <T.Content sideOffset={6} className="z-50 max-w-60 rounded-md bg-ink px-2.5 py-1.5 text-xs text-ink-fg shadow-md animate-fade-up">
          {content}
        </T.Content>
      </T.Portal>
    </T.Root>
  );
}
