"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "@/lib/toast";
import { KiProjectsTable } from "@/components/cockpit/KiProjectsTable";
import { EditDialog } from "@/components/cockpit/EditDialog";
import { RowActions } from "@/components/cockpit/RowActions";
import { FilterTabs } from "@/components/ui/FilterTabs";
import { Card, CardBody } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { IconSearch } from "@/components/ui/icons";
import { downloadCsv } from "@/lib/csv-export";
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
  useEffect(() => setItems(projects), [projects]);
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<"mrr" | "name" | "status">("mrr");
  const editFields = withCombobox(KIPROJECT_FIELDS, "account_name", accountNames);

  function resetFilters() {
    setQuery("");
    setFilter("all");
  }

  async function onDelete(id: string) {
    const prevItems = items;
    setItems((cur) => cur.filter((p) => p.id !== id));
    const res = await deleteKiProject(id);
    if (res.ok && !res.demo) {
      router.refresh();
    } else if (!res.ok) {
      setItems(prevItems);
      if (res.error) toast.error(res.error);
    }
  }

  const q = query.trim().toLowerCase();
  const byStatus = filter === "all" ? items : items.filter((p) => p.status === filter);
  const searched = q
    ? byStatus.filter((p) =>
        [p.account_name, p.product, p.segment, p.use_case]
          .filter(Boolean)
          .some((v) => String(v).toLowerCase().includes(q))
      )
    : byStatus;
  const shown = [...searched].sort((a, b) => {
    if (sort === "name") return a.account_name.localeCompare(b.account_name);
    if (sort === "status") return a.status.localeCompare(b.status);
    return (b.mrr ?? 0) - (a.mrr ?? 0);
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-0 flex-1">
          <IconSearch size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-faint" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="KI-Projekt suchen (Kunde, Produkt, Segment) …"
            className="w-full rounded-xl border border-border bg-surface py-2 pl-9 pr-3 text-sm text-ink placeholder:text-faint focus-visible:ring-2 focus-visible:ring-brand"
          />
        </div>
        <button
          type="button"
          onClick={() =>
            downloadCsv(
              `ki-projekte-${new Date().toISOString().slice(0, 10)}`,
              shown,
              [
                { key: "account_name", label: "Kunde" },
                { key: "product", label: "Produkt" },
                { key: "segment", label: "Segment" },
                { key: "status", label: "Status" },
                { key: "health", label: "Health" },
                { key: "mrr", label: "MRR" },
                { key: "setup_fee", label: "Setup" },
                { key: "go_live", label: "Go-Live" },
                { key: "project_manager", label: "Projektverantwortlich" },
                { key: "decision_maker", label: "Entscheider" },
                { key: "tech_contact", label: "Tech-Kontakt" },
                { key: "kickoff_date", label: "Kickoff" },
              ]
            )
          }
          className="rounded-xl border border-border bg-surface px-3 py-2 text-sm font-medium text-ink hover:bg-elevated"
          title="Gefilterte Liste als CSV exportieren"
        >
          Export
        </button>
      </div>

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
      {shown.length === 0 && items.length > 0 ? (
        <Card>
          <CardBody>
            <EmptyState
              title="Keine Treffer für deine Suche oder Filter."
              action={
                <button
                  type="button"
                  onClick={resetFilters}
                  className="rounded-lg border border-border bg-elevated px-3 py-1.5 text-xs font-semibold text-ink hover:bg-elevated/70"
                >
                  Filter zurücksetzen
                </button>
              }
            />
          </CardBody>
        </Card>
      ) : (
      <KiProjectsTable
        projects={shown}
        sort={sort}
        onSort={(k) => setSort(k as "mrr" | "name" | "status")}
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
                  use_case: p.use_case ?? "",
                  project_manager: p.project_manager ?? "",
                  kickoff_date: p.kickoff_date ?? "",
                  decision_maker: p.decision_maker ?? "",
                  tech_contact: p.tech_contact ?? "",
                }}
              />
            }
          />
        )}
      />
      )}
    </div>
  );
}
