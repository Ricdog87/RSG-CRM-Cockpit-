"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "@/lib/toast";
import { AccountsTable } from "@/components/cockpit/AccountsTable";
import { EditDialog } from "@/components/cockpit/EditDialog";
import { RowActions } from "@/components/cockpit/RowActions";
import { FilterTabs } from "@/components/ui/FilterTabs";
import { IconSearch } from "@/components/ui/icons";
import { ACCOUNT_FIELDS } from "@/lib/crm-forms";
import { downloadCsv } from "@/lib/csv-export";
import { updateAccount, deleteAccount } from "@/lib/crm-actions";
import type { Account, BusinessLine, Lifecycle } from "@/lib/crm-types";

type LineFilter = "all" | BusinessLine;
type Sort = "mrr" | "name" | "lifecycle" | "health";

export type HealthInfo = { score: number; tone: string; label: string };

/** Account-Liste mit Suche, Sortierung, Linien-Filter, Lifecycle-Filter, Bearbeiten und Löschen. */
export function AccountsView({
  accounts,
  healthById = {},
}: {
  accounts: Account[];
  healthById?: Record<string, HealthInfo>;
}) {
  const router = useRouter();
  const [items, setItems] = useState(accounts);
  useEffect(() => setItems(accounts), [accounts]);
  const [filter, setFilter] = useState<LineFilter>("all");
  const [lifecycle, setLifecycle] = useState<Lifecycle | "all">("all");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<Sort>("mrr");
  const [health, setHealth] = useState<"all" | "risk" | "watch" | "top">("all");

  async function onDelete(id: string) {
    const prev = items;
    setItems((p) => p.filter((a) => a.id !== id));
    const res = await deleteAccount(id);
    if (res.ok && !res.demo) {
      router.refresh();
    } else if (!res.ok) {
      setItems(prev); // Fehlgeschlagen → wiederherstellen
      if (res.error) toast.error(res.error);
    }
  }

  const q = query.trim().toLowerCase();

  // Nach Line-Filter (Basis für Lifecycle-Counts)
  const afterLineFilter = useMemo(
    () => (filter === "all" ? items : items.filter((a) => a.line === filter)),
    [items, filter]
  );

  const shown = useMemo(() => {
    let pool = afterLineFilter;
    if (lifecycle !== "all") {
      pool = pool.filter((a) => a.lifecycle === lifecycle);
    }
    if (health !== "all") {
      pool = pool.filter((a) => {
        const t = healthById[a.id]?.tone;
        if (health === "risk") return t === "danger";
        if (health === "watch") return t === "warning" || t === "danger";
        return t === "success";
      });
    }
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
    else if (sort === "health")
      arr.sort((a, b) => (healthById[a.id]?.score ?? 999) - (healthById[b.id]?.score ?? 999));
    else arr.sort((a, b) => (b.mrr ?? 0) - (a.mrr ?? 0));
    return arr;
  }, [afterLineFilter, lifecycle, q, sort, health, healthById]);

  // Paginierung: nur die ersten N rendern (Performance bei vielen Accounts).
  const PAGE = 60;
  const [visible, setVisible] = useState(PAGE);
  useEffect(() => setVisible(PAGE), [filter, lifecycle, q, sort, health]);
  const page = shown.slice(0, visible);

  const hasHealth = Object.keys(healthById).length > 0;
  const healthCount = (tone: "danger" | "warning" | "success") =>
    afterLineFilter.filter((a) => healthById[a.id]?.tone === tone).length;

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
          <option value="health">Health ↑ (Risiko zuerst)</option>
          <option value="name">Name A–Z</option>
          <option value="lifecycle">Lifecycle</option>
        </select>
        <button
          type="button"
          onClick={() =>
            downloadCsv(
              `kunden-${new Date().toISOString().slice(0, 10)}`,
              shown,
              [
                { key: "name", label: "Unternehmen" },
                { key: "branche", label: "Branche" },
                { key: "segment", label: "Segment" },
                { key: "line", label: "Linie" },
                { key: "lifecycle", label: "Lifecycle" },
                { key: "contact_name", label: "Ansprechpartner" },
                { key: "contact_email", label: "E-Mail" },
                { key: "contact_phone", label: "Telefon" },
                { key: "strasse", label: "Straße" },
                { key: "plz", label: "PLZ" },
                { key: "ort", label: "Ort" },
                { key: "country", label: "Land" },
                { key: "mrr", label: "MRR" },
                { key: "owner", label: "Zuständig" },
                { key: "id", label: "Health", get: (a) => healthById[a.id]?.score ?? "" },
              ]
            )
          }
          className="rounded-xl border border-border bg-surface px-3 py-2 text-sm font-medium text-ink hover:bg-elevated"
          title="Gefilterte Liste als CSV exportieren"
        >
          Export
        </button>
      </div>

      <FilterTabs<LineFilter>
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

      <FilterTabs<Lifecycle | "all">
        value={lifecycle}
        onChange={setLifecycle}
        options={[
          { value: "all", label: "Alle", count: afterLineFilter.length },
          { value: "lead", label: "Lead", count: afterLineFilter.filter((a) => a.lifecycle === "lead").length },
          { value: "opportunity", label: "Opportunity", count: afterLineFilter.filter((a) => a.lifecycle === "opportunity").length },
          { value: "kunde", label: "Kunde", count: afterLineFilter.filter((a) => a.lifecycle === "kunde").length },
          { value: "bestand", label: "Bestand", count: afterLineFilter.filter((a) => a.lifecycle === "bestand").length },
        ]}
      />

      {hasHealth ? (
        <FilterTabs<"all" | "risk" | "watch" | "top">
          value={health}
          onChange={setHealth}
          options={[
            { value: "all", label: "Health: alle", count: afterLineFilter.length },
            { value: "risk", label: "🔴 Gefährdet", count: healthCount("danger") },
            { value: "watch", label: "🟠 Beobachten", count: healthCount("warning") + healthCount("danger") },
            { value: "top", label: "🟢 Top", count: healthCount("success") },
          ]}
        />
      ) : null}

      <AccountsTable
        accounts={page}
        healthById={healthById}
        renderActions={(a) => (
          <RowActions
            confirmText={`„${a.name}“ wirklich löschen?`}
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
                  strasse: a.strasse ?? "",
                  plz: a.plz ?? "",
                  ort: a.ort,
                  country: a.country ?? "",
                  contact_name: a.contact_name,
                  contact_email: a.contact_email,
                  contact_phone: a.contact_phone ?? "",
                  owner: a.owner ?? "",
                  mrr: String(a.mrr ?? ""),
                }}
              />
            }
          />
        )}
      />

      {shown.length > visible ? (
        <div className="flex items-center justify-center gap-3 pt-1">
          <span className="text-xs text-faint">{visible} von {shown.length} angezeigt</span>
          <button
            type="button"
            onClick={() => setVisible((v) => v + PAGE)}
            className="rounded-lg border border-border bg-elevated px-3 py-1.5 text-xs font-semibold text-ink hover:bg-elevated/70"
          >
            Mehr anzeigen
          </button>
        </div>
      ) : null}
    </div>
  );
}
