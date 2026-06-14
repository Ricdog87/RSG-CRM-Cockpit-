"use client";

import { cn } from "@/components/ui/cn";

export interface FilterOption<T extends string> {
  value: T;
  label: string;
  count?: number;
}

/** Segmentierter Filter (z.B. Alle / KI / Recruiting). */
export function FilterTabs<T extends string>({
  options,
  value,
  onChange,
  className,
}: {
  options: FilterOption<T>[];
  value: T;
  onChange: (v: T) => void;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "inline-flex flex-wrap gap-1 rounded-xl border border-border bg-surface p-1",
        className
      )}
      role="tablist"
    >
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(o.value)}
            className={cn(
              "rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors",
              active ? "bg-brand text-white" : "text-muted hover:bg-elevated hover:text-ink"
            )}
          >
            {o.label}
            {typeof o.count === "number" ? (
              <span
                className={cn(
                  "ml-1.5 rounded-full px-1.5 py-0.5 text-[0.65rem]",
                  active ? "bg-white/20 text-white" : "bg-elevated text-faint"
                )}
              >
                {o.count}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
