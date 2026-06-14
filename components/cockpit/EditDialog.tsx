"use client";

import { EntityFormDialog, type FormField } from "@/components/cockpit/EntityFormDialog";
import { IconPencil } from "@/components/ui/icons";
import type { ActionResult } from "@/lib/crm-actions";

/** Bearbeiten-Dialog mit Stift-Trigger – dünner Wrapper um EntityFormDialog. */
export function EditDialog({
  id,
  title,
  description,
  fields,
  initial,
  action,
}: {
  id: string;
  title: string;
  description?: string;
  fields: FormField[];
  initial: Record<string, string>;
  action: (prev: ActionResult | null, fd: FormData) => Promise<ActionResult>;
}) {
  return (
    <EntityFormDialog
      title={title}
      description={description}
      fields={fields}
      action={action}
      hiddenId={id}
      initial={initial}
      submitLabel="Speichern"
      renderTrigger={(open) => (
        <button
          type="button"
          aria-label="Bearbeiten"
          onClick={open}
          className="rounded-lg p-1.5 text-faint transition-colors hover:bg-elevated hover:text-ink"
        >
          <IconPencil size={16} />
        </button>
      )}
    />
  );
}
