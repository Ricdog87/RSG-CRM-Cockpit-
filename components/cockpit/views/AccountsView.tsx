"use client";

import { useState } from "react";
import { AccountsTable } from "@/components/cockpit/AccountsTable";
import { FilterTabs } from "@/components/ui/FilterTabs";
import type { Account, BusinessLine } from "@/lib/crm-types";

type Filter = "all" | BusinessLine;

/** Account-Liste mit Linien-Filter (KI / Recruiting). */
export function AccountsView({ accounts }: { accounts: Account[] }) {
  const [filter, setFilter] = useState<Filter>("all");
  const shown = filter === "all" ? accounts : accounts.filter((a) => a.line === filter);

  return (
    <div className="space-y-4">
      <FilterTabs<Filter>
        value={filter}
        onChange={setFilter}
        options={[
          { value: "all", label: "Alle", count: accounts.length },
          { value: "ki", label: "KI", count: accounts.filter((a) => a.line === "ki").length },
          {
            value: "recruiting",
            label: "Recruiting",
            count: accounts.filter((a) => a.line === "recruiting").length,
          },
        ]}
      />
      <AccountsTable accounts={shown} />
    </div>
  );
}
