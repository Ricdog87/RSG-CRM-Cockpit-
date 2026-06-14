"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AccountsTable } from "@/components/cockpit/AccountsTable";
import { EntityFormDialog } from "@/components/cockpit/EntityFormDialog";
import { RowActions } from "@/components/cockpit/RowActions";
import { FilterTabs } from "@/components/ui/FilterTabs";
import { IconPencil } from "@/components/ui/icons";
import { ACCOUNT_FIELDS } from "@/lib/crm-forms";
import { updateAccount, deleteAccount } from "@/lib/crm-actions";
import type { Account, BusinessLine } from "@/lib/crm-types";

type Filter = "all" | BusinessLine;

/** Account-Liste mit Linien-Filter, Bearbeiten und Löschen. */
export function AccountsView({ accounts }: { accounts: Account[] }) {
  const router = useRouter();
  const [items, setItems] = useState(accounts);
  const [filter, setFilter] = useState<Filter>("all");

  async function onDelete(id: string) {
    setItems((prev) => prev.filter((a) => a.id !== id));
    const res = await deleteAccount(id);
    if (res.ok && !res.demo) router.refresh();
  }

  const shown = filter === "all" ? items : items.filter((a) => a.line === filter);

  return (
    <div className="space-y-4">
      <FilterTabs<Filter>
        value={filter}
        onChange={setFilter}
        options={[
          { value: "all", label: "Alle", count: items.length },
          { value: "ki", label: "KI", count: items.filter((a) => a.line === "ki").length },
          {
            value: "recruiting",
            label: "Recruiting",
            count: items.filter((a) => a.line === "recruiting").length,
          },
        ]}
      />
      <AccountsTable
        accounts={shown}
        renderActions={(a) => (
          <RowActions
            confirmText={`„${a.name}" wirklich löschen?`}
            onDelete={() => onDelete(a.id)}
            editNode={
              <EntityFormDialog
                title="Account bearbeiten"
                description="Stammdaten und Lifecycle aktualisieren."
                fields={ACCOUNT_FIELDS}
                action={updateAccount}
                hiddenId={a.id}
                submitLabel="Speichern"
                initial={{
                  name: a.name,
                  line: a.line,
                  lifecycle: a.lifecycle,
                  branche: a.branche,
                  segment: a.segment,
                  ort: a.ort,
                  contact_name: a.contact_name,
                  contact_email: a.contact_email,
                  mrr: String(a.mrr ?? ""),
                }}
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
    </div>
  );
}
