"use client";

import { cn } from "@/components/ui/cn";

export interface ViewOption<T extends string> {
  value: T;
  label: string;
  icon?: React.ReactNode;
}

/**
 * Segmentierter Ansichts-Umschalter (z.B. Board / Liste / Kunden).
 * Bewusst getrennt von FilterTabs: schaltet das Layout um, filtert keine Daten.
 */
export function ViewToggle<T extends string>({
  options,
  value,
  onChange,
}: {
  options: ViewOption<T>[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex w-fit items-center gap-1 rounded-xl border border-border bg-elevated/60 p-1">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          aria-pressed={value === o.value}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors",
            value === o.value ? "bg-surface text-ink shadow-sm" : "text-muted hover:text-ink"
          )}
        >
          {o.icon}
          {o.label}
        </button>
      ))}
    </div>
  );
}
