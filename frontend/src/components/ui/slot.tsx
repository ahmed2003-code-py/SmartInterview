import { cloneElement, forwardRef, isValidElement, type HTMLAttributes, type ReactElement } from "react";
import { cn } from "@/lib/utils";

/** Renders its single child with the parent's props merged in (for `asChild`). */
export const Slot = forwardRef<HTMLElement, HTMLAttributes<HTMLElement> & { disabled?: boolean }>(function Slot({ children, className, disabled: _d, ...props }, ref) {
  if (!isValidElement(children)) return null;
  const child = children as ReactElement<{ className?: string }>;
  return cloneElement(child, { ...props, ...(child.props as object), ref, className: cn(className, child.props.className) } as never);
});
