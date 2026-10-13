import { forwardRef, type ButtonHTMLAttributes } from "react";
import { Slot } from "./slot";
import { cn } from "@/lib/utils";
import { Spinner } from "./spinner";

const variants = {
  primary: "bg-primary text-primary-fg hover:bg-primary-hover shadow-sm",
  secondary: "bg-surface text-fg border border-border hover:bg-surface-2 hover:border-border-strong shadow-sm",
  ghost: "text-muted hover:text-fg hover:bg-surface-2",
  danger: "bg-surface text-danger border border-border hover:bg-danger-soft hover:border-danger/40",
  inverted: "bg-white text-[#0b1226] hover:bg-white/90",
};

const sizes = {
  sm: "h-8 px-3 text-[13px] gap-1.5 rounded-md",
  md: "h-10 px-4 text-sm gap-2 rounded-md",
  lg: "h-12 px-5 text-[15px] gap-2 rounded-lg",
  icon: "h-9 w-9 rounded-md",
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
        "inline-flex shrink-0 items-center justify-center font-medium whitespace-nowrap transition-colors duration-150 select-none",
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
