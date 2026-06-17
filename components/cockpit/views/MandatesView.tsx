"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { MandatesList } from "@/components/cockpit/MandatesList";
import { MandatesBoard } from "@/components/cockpit/MandatesBoard";
import { MandatesByCustomer } from "@/components/cockpit/MandatesByCustomer";
import { MandateFormDialog } from "@/components/cockpit/MandateFormDialog";
import { RowActions } from "@/components/cockpit/RowActions";
import { IconPencil, IconLayers, IconTasks, IconUsers } from "@/components/ui/icons";
import { cn } from "@/components/ui/cn";
import { deleteMandate } from "@/lib/crm-actions";
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
  const [view, setView] = useState<View>("board");

  async function onDelete(id: string) {
    setItems((prev) => prev.filter((m) => m.id !== id));
    const res = await deleteMandate(id);
    if (res.ok && !res.demo) router.refresh();
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
      <div className="flex items-center gap-1 rounded-xl border border-border bg-surface p-1 w-fit">
        {([
          { key: "board", label: "Board", icon: IconLayers },
          { key: "kunden", label: "Kunden", icon: IconUsers },
          { key: "liste", label: "Liste", icon: IconTasks },
        ] as const).map((v) => {
          const Icon = v.icon;
          return (
            <button
              key={v.key}
              type="button"
              onClick={() => setView(v.key)}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
                view === v.key ? "bg-elevated text-ink shadow-sm" : "text-muted hover:text-ink"
              )}
            >
              <Icon size={15} /> {v.label}
            </button>
          );
        })}
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
