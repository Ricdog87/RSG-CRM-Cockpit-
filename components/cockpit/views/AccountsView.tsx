"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AccountsTable } from "@/components/cockpit/AccountsTable";
import { EditDialog } from "@/components/cockpit/EditDialog";
import { RowActions } from "@/components/cockpit/RowActions";
import { FilterTabs } from "@/components/ui/FilterTabs";
import { IconSearch } from "@/components/ui/icons";
import { ACCOUNT_FIELDS } from "@/lib/crm-forms";
import { updateAccount, deleteAccount } from "@/lib/crm-actions";
import type { Account, BusinessLine } from "@/lib/crm-types";

type Filter = "all" | BusinessLine;
type Sort = "mrr" | "name" | "lifecycle";

/** Account-Liste mit Suche, Sortierung, Linien-Filter, Bearbeiten und Löschen. */
export function AccountsView({ accounts }: { accounts: Account[] }) {
  const router = useRouter();
  const [items, setItems] = useState(accounts);
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<Sort>("mrr");

  async function onDelete(id: string) {
    setItems((prev) => prev.filter((a) => a.id !== id));
    const res = await deleteAccount(id);
    if (res.ok && !res.demo) router.refresh();
  }

  const q = query.trim().toLowerCase();
  const shown = useMemo(() => {
    let pool = filter === "all" ? items : items.filter((a) => a.line === filter);
    if (q) {
      pool = pool.filter((a) =>
        [a.name, a.branche, a.segment, a.ort, a.contact_name, a.contact_email]
          .filter(Boolean)
          .some((v) => String(v).toLowerCase().includes(q))
      );
    }
    const arr = [...pool];
    if (sort === "name") arr.sort((a, b) => a.name.localeCompare(b.name));
    else if (sort === "lifecycle") arr.sort((a, b) => a.lifecycle.localeCompare(b.lifecycle));
    else arr.sort((a, b) => (b.mrr ?? 0) - (a.mrr ?? 0));
    return arr;
  }, [items, filter, q, sort]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-0 flex-1">
          <IconSearch size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-faint" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Account suchen (Name, Branche, Ort, Kontakt) …"
            className="w-full rounded-xl border border-border bg-surface py-2 pl-9 pr-3 text-sm text-ink placeholder:text-faint focus-visible:ring-2 focus-visible:ring-brand"
          />
        </div>
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value as Sort)}
          aria-label="Sortieren"
          className="rounded-xl border border-border bg-surface px-3 py-2 text-sm text-ink focus-visible:ring-2 focus-visible:ring-brand"
        >
          <option value="mrr">MRR ↓</option>
          <option value="name">Name A–Z</option>
          <option value="lifecycle">Lifecycle</option>
        </select>
      </div>

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
              <EditDialog
                id={a.id}
                title="Account bearbeiten"
                description="Stammdaten und Lifecycle aktualisieren."
                fields={ACCOUNT_FIELDS}
                action={updateAccount}
                initial={{
                  name: a.name,
                  line: a.line,
                  lifecycle: a.lifecycle,
                  branche: a.branche,
                  segment: a.segment,
                  ort: a.ort,
                  contact_name: a.contact_name,
                  contact_email: a.contact_email,
                  contact_phone: a.contact_phone ?? "",
                  mrr: String(a.mrr ?? ""),
                }}
              />
            }
          />
        )}
      />
    </div>
  );
}
