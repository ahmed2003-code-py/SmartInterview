import { forwardRef, type ButtonHTMLAttributes } from "react";
import { Slot } from "./slot";
import { cn } from "@/lib/utils";
import { Spinner } from "./spinner";

const variants = {
  primary: "bg-primary text-primary-fg shadow-[inset_0_1px_0_rgb(255_255_255/0.14),0_1px_2px_rgb(0_0_0/0.12)] hover:bg-primary-hover",
  secondary: "bg-surface text-fg border border-border-strong/80 shadow-sm hover:border-border-strong hover:bg-surface-2",
  ghost: "text-muted hover:text-fg hover:bg-surface-2",
  danger: "text-danger hover:bg-danger-soft",
  ink: "bg-ink text-ink-fg hover:opacity-90",
};

const sizes = {
  sm: "h-8 px-3 text-[13px] gap-1.5 rounded-lg",
  md: "h-9 px-4 text-sm gap-2 rounded-lg",
  lg: "h-11 px-5 text-[15px] gap-2 rounded-xl",
  icon: "h-9 w-9 rounded-lg",
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: keyof typeof variants;
  size?: keyof typeof sizes;
  loading?: boolean;
  asChild?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "primary", size = "md", loading, asChild, className, children, disabled, ...props },
  ref,
) {
  const Comp = asChild ? Slot : "button";
  return (
    <Comp
      ref={ref}
      className={cn(
        "inline-flex shrink-0 items-center justify-center font-medium whitespace-nowrap select-none transition-[color,background-color,border-color,box-shadow,transform] duration-150 active:scale-[0.97]",
        "disabled:pointer-events-none disabled:opacity-50",
        variants[variant],
        sizes[size],
        className,
      )}
      disabled={disabled || loading}
      {...props}
    >
      {asChild ? (
        children
      ) : (
        <>
          {loading && <Spinner className="size-4" />}
          {children}
        </>
      )}
    </Comp>
  );
});
