"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { MandatesList } from "@/components/cockpit/MandatesList";
import { MandateFormDialog } from "@/components/cockpit/MandateFormDialog";
import { RowActions } from "@/components/cockpit/RowActions";
import { IconPencil } from "@/components/ui/icons";
import { deleteMandate } from "@/lib/crm-actions";
import type { RecruitingMandate, Candidate } from "@/lib/crm-types";

/** Mandatsliste mit Bearbeiten und Löschen. */
export function MandatesView({
  mandates,
  accountNames = [],
  candidates = [],
}: {
  mandates: RecruitingMandate[];
  accountNames?: string[];
  candidates?: Candidate[];
}) {
  const router = useRouter();
  const [items, setItems] = useState(mandates);

  async function onDelete(id: string) {
    setItems((prev) => prev.filter((m) => m.id !== id));
    const res = await deleteMandate(id);
    if (res.ok && !res.demo) router.refresh();
  }

  return (
    <MandatesList
      mandates={items}
      candidates={candidates}
      renderActions={(m) => (
        <RowActions
          confirmText={`Mandat „${m.role}" wirklich löschen?`}
          onDelete={() => onDelete(m.id)}
          editNode={
            <MandateFormDialog
              mandate={m}
              accountNames={accountNames}
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
          }
        />
      )}
    />
  );
}
