"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { IconTrash, IconCheck, IconClose } from "@/components/ui/icons";

/** Zeilen-Aktionen (Bearbeiten-Trigger + Löschen mit Inline-Rückfrage). */
export function RowActions({
  editNode,
  onDelete,
  confirmText = "Löschen?",
}: {
  editNode?: React.ReactNode;
  onDelete: () => Promise<void> | void;
  confirmText?: string;
}) {
  const [pending, startTransition] = useTransition();
  const [confirming, setConfirming] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Außerhalb-Klick / Escape bricht die Rückfrage ab.
  useEffect(() => {
    if (!confirming) return;
    function onDoc(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setConfirming(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setConfirming(false);
    }
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [confirming]);

  return (
    <div ref={ref} className="flex items-center justify-end gap-1">
      {confirming ? (
        <div className="flex items-center gap-1.5 rounded-lg border border-danger/30 bg-danger/[0.06] px-2 py-1">
          <span className="text-xs font-medium text-danger">{confirmText}</span>
          <button
            type="button"
            aria-label="Löschen bestätigen"
            disabled={pending}
            onClick={() => {
              setConfirming(false);
              startTransition(() => {
                void onDelete();
              });
            }}
            className="rounded-md bg-danger px-1.5 py-1 text-white transition-colors hover:bg-danger/90 disabled:opacity-50"
          >
            <IconCheck size={13} />
          </button>
          <button
            type="button"
            aria-label="Abbrechen"
            onClick={() => setConfirming(false)}
            className="rounded-md p-1 text-muted transition-colors hover:text-ink"
          >
            <IconClose size={13} />
          </button>
        </div>
      ) : (
        <>
          {editNode}
          <button
            type="button"
            aria-label="Löschen"
            disabled={pending}
            onClick={() => setConfirming(true)}
            className="rounded-lg p-1.5 text-faint transition-colors hover:bg-danger/10 hover:text-danger disabled:opacity-50"
          >
            <IconTrash size={16} />
          </button>
        </>
      )}
    </div>
  );
}
