"use client";

import { useTransition } from "react";
import { cn } from "@/components/ui/cn";

/**
 * Kleines Phasen-Auswahlfeld auf Kanban-Karten. Verschiebt die Karte
 * (optimistisch über onMove) und persistiert über die übergebene Action.
 */
export function MoveSelect<S extends string>({
  value,
  options,
  onMove,
}: {
  value: S;
  options: { value: S; label: string }[];
  onMove: (stage: S) => Promise<void> | void;
}) {
  const [pending, startTransition] = useTransition();

  return (
    <label className="mt-2 block">
      <span className="sr-only">Phase ändern</span>
      <select
        value={value}
        disabled={pending}
        onChange={(e) => {
          const next = e.target.value as S;
          if (next === value) return;
          startTransition(() => {
            void onMove(next);
          });
        }}
        onClick={(e) => e.stopPropagation()}
        className={cn(
          "w-full cursor-pointer rounded-lg border border-border bg-surface px-2 py-1 text-xs text-muted transition-colors hover:border-brand/40 focus-visible:ring-2 focus-visible:ring-brand",
          pending && "opacity-60"
        )}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            → {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}
