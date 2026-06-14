"use client";

import { useState } from "react";
import { KiProjectsTable } from "@/components/cockpit/KiProjectsTable";
import { FilterTabs } from "@/components/ui/FilterTabs";
import type { KiProject, KiStatus } from "@/lib/crm-types";

type Filter = "all" | KiStatus;

const STATUS: { value: Filter; label: string }[] = [
  { value: "all", label: "Alle" },
  { value: "live", label: "Live" },
  { value: "onboarding", label: "Onboarding" },
  { value: "optimierung", label: "Optimierung" },
  { value: "pausiert", label: "Pausiert" },
];

/** KI-Projekttabelle mit Status-Filter. */
export function KiProjectsView({ projects }: { projects: KiProject[] }) {
  const [filter, setFilter] = useState<Filter>("all");
  const shown = filter === "all" ? projects : projects.filter((p) => p.status === filter);

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
              ? projects.length
              : projects.filter((p) => p.status === s.value).length,
        }))}
      />
      <KiProjectsTable projects={shown} />
    </div>
  );
}
