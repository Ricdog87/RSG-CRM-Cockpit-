"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { MandatesList } from "@/components/cockpit/MandatesList";
import { EditDialog } from "@/components/cockpit/EditDialog";
import { RowActions } from "@/components/cockpit/RowActions";
import { MANDATE_FIELDS, withDatalist } from "@/lib/crm-forms";
import { updateMandate, deleteMandate } from "@/lib/crm-actions";
import type { RecruitingMandate } from "@/lib/crm-types";

/** Mandatsliste mit Bearbeiten und Löschen. */
export function MandatesView({
  mandates,
  accountNames = [],
}: {
  mandates: RecruitingMandate[];
  accountNames?: string[];
}) {
  const router = useRouter();
  const [items, setItems] = useState(mandates);
  const editFields = withDatalist(MANDATE_FIELDS, "account_name", accountNames);

  async function onDelete(id: string) {
    setItems((prev) => prev.filter((m) => m.id !== id));
    const res = await deleteMandate(id);
    if (res.ok && !res.demo) router.refresh();
  }

  return (
    <MandatesList
      mandates={items}
      renderActions={(m) => (
        <RowActions
          confirmText={`Mandat „${m.role}" wirklich löschen?`}
          onDelete={() => onDelete(m.id)}
          editNode={
            <EditDialog
              id={m.id}
              title="Mandat bearbeiten"
              description="Stellen, Besetzung und Status aktualisieren."
              fields={editFields}
              action={updateMandate}
              initial={{
                account_name: m.account_name,
                role: m.role,
                positions: String(m.positions ?? ""),
                filled: String(m.filled ?? ""),
                fee: String(m.fee ?? ""),
                status: m.status,
                deadline: m.deadline,
              }}
            />
          }
        />
      )}
    />
  );
}
