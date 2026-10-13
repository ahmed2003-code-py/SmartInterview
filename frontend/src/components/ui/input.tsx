import { forwardRef, type InputHTMLAttributes, type ReactNode, type TextareaHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

const field =
  "w-full rounded-md border border-border bg-surface text-fg placeholder:text-subtle transition-colors outline-none hover:border-border-strong focus:border-primary focus:ring-3 focus:ring-primary/15 disabled:opacity-60 aria-invalid:border-danger aria-invalid:focus:ring-danger/15";

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function Input({ className, ...props }, ref) {
  return <input ref={ref} className={cn(field, "h-10 px-3 text-sm", className)} {...props} />;
});

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(function Textarea({ className, ...props }, ref) {
  return <textarea ref={ref} className={cn(field, "min-h-28 px-3 py-2.5 text-sm leading-relaxed resize-y", className)} {...props} />;
});

export function Field({ label, htmlFor, hint, error, aside, children }: { label: ReactNode; htmlFor?: string; hint?: ReactNode; error?: string | null; aside?: ReactNode; children: ReactNode }) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between gap-3">
        <label htmlFor={htmlFor} className="text-sm font-medium text-fg">
          {label}
        </label>
        {aside}
      </div>
      {children}
      {error ? <p className="text-[13px] text-danger">{error}</p> : hint ? <p className="text-[13px] text-muted">{hint}</p> : null}
    </div>
  );
}
