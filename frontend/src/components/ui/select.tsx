import * as S from "@radix-ui/react-select";
import { Check, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { useI18n } from "@/i18n";

const ALL = "__all__";

/** Compact select; an empty string value means "all". */
export function Select({ value, onChange, options, placeholder, className, label }: { value: string; onChange: (v: string) => void; options: { value: string; label: string }[]; placeholder: string; className?: string; label: string }) {
  const { dir } = useI18n();
  return (
    <S.Root value={value || ALL} onValueChange={(v) => onChange(v === ALL ? "" : v)} dir={dir}>
      <S.Trigger aria-label={label} className={cn("inline-flex h-9 items-center justify-between gap-2 rounded-lg border border-border bg-surface px-3 text-sm text-fg shadow-sm transition-colors outline-none hover:border-border-strong focus-visible:border-primary data-[placeholder]:text-muted", className)}>
        <S.Value placeholder={placeholder} />
        <S.Icon>
          <ChevronDown className="size-4 text-subtle" />
        </S.Icon>
      </S.Trigger>
      <S.Portal>
        <S.Content position="popper" sideOffset={6} className="z-50 max-h-72 min-w-(--radix-select-trigger-width) overflow-hidden rounded-xl border border-border bg-surface p-1 shadow-lg animate-pop-in">
          <S.Viewport>
            {[{ value: ALL, label: placeholder }, ...options].map((o) => (
              <S.Item key={o.value} value={o.value} className="flex h-9 cursor-pointer items-center justify-between gap-4 rounded-md px-2.5 text-sm text-fg outline-none select-none data-[highlighted]:bg-surface-2">
                <S.ItemText>{o.label}</S.ItemText>
                <S.ItemIndicator>
                  <Check className="size-4 text-primary" />
                </S.ItemIndicator>
              </S.Item>
            ))}
          </S.Viewport>
        </S.Content>
      </S.Portal>
    </S.Root>
  );
}
