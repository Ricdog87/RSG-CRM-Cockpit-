"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "@/lib/toast";
import { MandatesList } from "@/components/cockpit/MandatesList";
import { MandatesBoard } from "@/components/cockpit/MandatesBoard";
import { MandatesByCustomer } from "@/components/cockpit/MandatesByCustomer";
import { MandateFormDialog } from "@/components/cockpit/MandateFormDialog";
import { RowActions } from "@/components/cockpit/RowActions";
import { ViewToggle } from "@/components/ui/ViewToggle";
import { IconPencil, IconLayers, IconTasks, IconUsers } from "@/components/ui/icons";
import { downloadCsv } from "@/lib/csv-export";
import { deleteMandate } from "@/lib/crm-actions";
import { mandateRevenue } from "@/lib/crm-types";
import type { RecruitingMandate, Candidate } from "@/lib/crm-types";

type View = "board" | "kunden" | "liste";

/** Mandate als verschiebbares Kanban-Board oder Liste – mit Bearbeiten/Löschen. */
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
  useEffect(() => setItems(mandates), [mandates]);
  const [view, setView] = useState<View>("board");

  async function onDelete(id: string) {
    const prevItems = items;
    setItems((p) => p.filter((m) => m.id !== id));
    const res = await deleteMandate(id);
    if (res.ok && !res.demo) {
      router.refresh();
    } else if (!res.ok) {
      setItems(prevItems);
      if (res.error) toast.error(res.error);
    }
  }

  const renderActions = (m: RecruitingMandate) => (
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
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <ViewToggle<View>
          value={view}
          onChange={setView}
          options={[
            { value: "board", label: "Board", icon: <IconLayers size={14} /> },
            { value: "kunden", label: "Kunden", icon: <IconUsers size={14} /> },
            { value: "liste", label: "Liste", icon: <IconTasks size={14} /> },
          ]}
        />
        <button
          type="button"
          onClick={() =>
            downloadCsv(
              `mandate-${new Date().toISOString().slice(0, 10)}`,
              items,
              [
                { key: "account_name", label: "Kunde" },
                { key: "role", label: "Position" },
                { key: "status", label: "Status" },
                { key: "positions", label: "Stellen" },
                { key: "filled", label: "Besetzt" },
                { key: "deadline", label: "Frist" },
                { key: "pricing_model", label: "Honorarmodell" },
                { key: "id", label: "Erwarteter Umsatz", get: (m) => mandateRevenue(m) },
              ]
            )
          }
          className="rounded-xl border border-border bg-surface px-3 py-2 text-sm font-medium text-ink hover:bg-elevated"
          title="Mandate als CSV exportieren"
        >
          Export
        </button>
      </div>

      {view === "board" ? (
        <MandatesBoard mandates={items} candidates={candidates} renderActions={renderActions} />
      ) : view === "kunden" ? (
        <MandatesByCustomer mandates={items} candidates={candidates} renderActions={renderActions} />
      ) : (
        <MandatesList mandates={items} candidates={candidates} renderActions={renderActions} />
      )}
    </div>
  );
}
