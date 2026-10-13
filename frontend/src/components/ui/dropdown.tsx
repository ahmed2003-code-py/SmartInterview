import * as M from "@radix-ui/react-dropdown-menu";
import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/utils";

export const Menu = M.Root;
export const MenuTrigger = M.Trigger;

export function MenuContent({ children, align = "end", className }: { children: ReactNode; align?: "start" | "end" | "center"; className?: string }) {
  return (
    <M.Portal>
      <M.Content align={align} sideOffset={6} className={cn("z-50 min-w-44 rounded-xl border border-border bg-surface p-1 shadow-lg animate-pop-in", className)}>
        {children}
      </M.Content>
    </M.Portal>
  );
}

export function MenuItem({ className, ...props }: ComponentProps<typeof M.Item>) {
  return <M.Item className={cn("flex h-9 cursor-pointer items-center gap-2 rounded-md px-2.5 text-sm text-fg outline-none select-none data-[highlighted]:bg-surface-2 [&_svg]:size-4 [&_svg]:text-muted", className)} {...props} />;
}

export function MenuRadioGroup(props: ComponentProps<typeof M.RadioGroup>) {
  return <M.RadioGroup {...props} />;
}

export function MenuRadioItem({ className, children, ...props }: ComponentProps<typeof M.RadioItem>) {
  return (
    <M.RadioItem className={cn("flex h-9 cursor-pointer items-center justify-between gap-6 rounded-md px-2.5 text-sm text-fg outline-none select-none data-[highlighted]:bg-surface-2 [&_svg]:size-4 [&_svg]:text-muted", className)} {...props}>
      <span className="flex items-center gap-2">{children}</span>
      <M.ItemIndicator>
        <span className="block size-1.5 rounded-full bg-primary" />
      </M.ItemIndicator>
    </M.RadioItem>
  );
}

export function MenuLabel({ className, ...props }: ComponentProps<typeof M.Label>) {
  return <M.Label className={cn("px-2.5 py-1.5 text-xs text-subtle", className)} {...props} />;
}

export function MenuSeparator() {
  return <M.Separator className="my-1 h-px bg-border" />;
}
