"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { KiProjectsTable } from "@/components/cockpit/KiProjectsTable";
import { EditDialog } from "@/components/cockpit/EditDialog";
import { RowActions } from "@/components/cockpit/RowActions";
import { FilterTabs } from "@/components/ui/FilterTabs";
import { KIPROJECT_FIELDS, withCombobox } from "@/lib/crm-forms";
import { updateKiProject, deleteKiProject } from "@/lib/crm-actions";
import type { KiProject, KiStatus } from "@/lib/crm-types";

type Filter = "all" | KiStatus;

const STATUS: { value: Filter; label: string }[] = [
  { value: "all", label: "Alle" },
  { value: "angebot", label: "Angebot" },
  { value: "live", label: "Live" },
  { value: "onboarding", label: "Onboarding" },
  { value: "optimierung", label: "Optimierung" },
  { value: "pausiert", label: "Pausiert" },
];

/** KI-Projekttabelle mit Status-Filter, Bearbeiten und Löschen. */
export function KiProjectsView({
  projects,
  accountNames = [],
}: {
  projects: KiProject[];
  accountNames?: string[];
}) {
  const router = useRouter();
  const [items, setItems] = useState(projects);
  const [filter, setFilter] = useState<Filter>("all");
  const editFields = withCombobox(KIPROJECT_FIELDS, "account_name", accountNames);

  async function onDelete(id: string) {
    setItems((prev) => prev.filter((p) => p.id !== id));
    const res = await deleteKiProject(id);
    if (res.ok && !res.demo) router.refresh();
  }

  const shown = filter === "all" ? items : items.filter((p) => p.status === filter);

  return (
    <div className="space-y-4">
      <FilterTabs<Filter>
        value={filter}
        onChange={setFilter}
        options={STATUS.map((s) => ({
          value: s.value,
          label: s.label,
          count:
            s.value === "all"
              ? items.length
              : items.filter((p) => p.status === s.value).length,
        }))}
      />
      <KiProjectsTable
        projects={shown}
        renderActions={(p) => (
          <RowActions
            confirmText={`Projekt „${p.account_name}" wirklich löschen?`}
            onDelete={() => onDelete(p.id)}
            editNode={
              <EditDialog
                id={p.id}
                title="KI-Projekt bearbeiten"
                description="Status, Health und MRR aktualisieren."
                fields={editFields}
                action={updateKiProject}
                initial={{
                  account_name: p.account_name,
                  product: p.product,
                  segment: p.segment,
                  status: p.status,
                  health: p.health,
                  setup_fee: p.setup_fee ? String(p.setup_fee) : "",
                  mrr: String(p.mrr ?? ""),
                  go_live: p.go_live,
                }}
              />
            }
          />
        )}
      />
    </div>
  );
}
