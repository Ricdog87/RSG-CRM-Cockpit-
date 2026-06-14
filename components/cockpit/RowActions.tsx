"use client";

import { useTransition } from "react";
import { IconTrash } from "@/components/ui/icons";

/** Zeilen-Aktionen (Bearbeiten-Trigger + Löschen mit Rückfrage). */
export function RowActions({
  editNode,
  onDelete,
  confirmText = "Diesen Datensatz wirklich löschen?",
}: {
  editNode?: React.ReactNode;
  onDelete: () => Promise<void> | void;
  confirmText?: string;
}) {
  const [pending, startTransition] = useTransition();

  return (
    <div className="flex items-center justify-end gap-1">
      {editNode}
      <button
        type="button"
        aria-label="Löschen"
        disabled={pending}
        onClick={() => {
          if (!window.confirm(confirmText)) return;
          startTransition(() => {
            void onDelete();
          });
        }}
        className="rounded-lg p-1.5 text-faint transition-colors hover:bg-danger/10 hover:text-danger disabled:opacity-50"
      >
        <IconTrash size={16} />
      </button>
    </div>
  );
}
