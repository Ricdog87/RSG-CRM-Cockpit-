"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "@/lib/toast";
import { KanbanBoard, type BoardColumn } from "@/components/cockpit/KanbanBoard";
import { LineBadge } from "@/components/cockpit/LineBadge";
import { MoveSelect } from "@/components/cockpit/MoveSelect";
import { OppScore } from "@/components/cockpit/OppScore";
import { RowActions } from "@/components/cockpit/RowActions";
import { EditDialog } from "@/components/cockpit/EditDialog";
import { OPPORTUNITY_FIELDS } from "@/lib/crm-forms";
import { FilterTabs } from "@/components/ui/FilterTabs";
import { cn } from "@/components/ui/cn";
import { updateOpportunityStage, updateOpportunity, deleteOpportunity } from "@/lib/crm-actions";
import { formatDate, formatEur, formatPercent } from "@/lib/format";
import type { BusinessLine, Opportunity, SalesStage } from "@/lib/crm-types";

type Filter = "all" | BusinessLine | "verloren";

const COLUMNS: BoardColumn<SalesStage>[] = [
  { stage: "neu", label: "Neu", tone: "neutral" },
  { stage: "qualifiziert", label: "Qualifiziert", tone: "sky" },
  { stage: "demo", label: "Demo/Termin", tone: "sky" },
  { stage: "angebot", label: "Angebot", tone: "brand" },
  { stage: "verhandlung", label: "Verhandlung", tone: "brand" },
  { stage: "gewonnen", label: "Gewonnen", tone: "success" },
];

const STAGE_OPTIONS = [
  ...COLUMNS.map((c) => ({ value: c.stage as SalesStage, label: c.label })),
  { value: "verloren" as SalesStage, label: "Verloren" },
];

function value(o: Opportunity) {
  return o.value_type === "mrr" ? `${formatEur(o.value)}/M` : formatEur(o.value);
}

/** „Rotting“: offene Chance mit überschrittenem erwartetem Abschluss. */
function overdueDays(o: Opportunity): number | null {
  if (o.stage === "gewonnen" || o.stage === "verloren" || !o.expected_close) return null;
  const t = new Date(o.expected_close + "T00:00:00").getTime();
  if (Number.isNaN(t)) return null;
  const d = Math.round((Date.now() - t) / 86400000);
  return d > 0 ? d : null;
}

function OppCard({
  o,
  onMove,
  onDelete,
}: {
  o: Opportunity;
  onMove: (id: string, stage: SalesStage) => void;
  onDelete: (id: string) => void;
}) {
  const rotting = overdueDays(o);
  return (
    <div
      className={cn(
        "rounded-xl border bg-elevated/50 p-3 transition-colors hover:border-brand/40",
        rotting != null ? "border-danger/40" : "border-border"
      )}
    >
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <p className="min-w-0 flex-1 truncate text-sm font-medium text-ink">{o.account_name}</p>
        <LineBadge line={o.line} />
        <RowActions
          confirmText={`Verkaufschance „${o.title || o.account_name}" wirklich löschen?`}
          onDelete={() => onDelete(o.id)}
          editNode={
            <EditDialog
              id={o.id}
              title="Verkaufschance bearbeiten"
              description="Titel, Wert, Wahrscheinlichkeit, Phase & Abschluss aktualisieren."
              fields={OPPORTUNITY_FIELDS}
              action={updateOpportunity}
              initial={{
                account_name: o.account_name,
                title: o.title,
                line: o.line,
                value_type: o.value_type,
                value: String(o.value ?? ""),
                probability: String(o.probability ?? ""),
                stage: o.stage,
                owner: o.owner,
                expected_close: o.expected_close || "",
              }}
            />
          }
        />
      </div>
      <p className="truncate text-xs text-muted">{o.title}</p>
      {rotting != null ? (
        <p className="mt-1 inline-flex items-center gap-1 rounded-full bg-danger/10 px-2 py-0.5 text-[0.65rem] font-semibold text-danger">
          ● Abschluss {rotting} T überfällig
        </p>
      ) : null}
      <div className="mt-3 flex items-center justify-between">
        <span className="text-sm font-semibold text-ink">{value(o)}</span>
        <span className="text-xs text-faint">{formatPercent(o.probability)}</span>
      </div>
      <p className="mt-1 text-[0.7rem] text-faint">
        {o.owner} · {formatDate(o.expected_close)}
      </p>
      <MoveSelect<SalesStage>
        value={o.stage}
        options={STAGE_OPTIONS}
        onMove={(stage) => onMove(o.id, stage)}
      />
      <OppScore
        input={{
          account_name: o.account_name,
          line: o.line,
          title: o.title,
          value: o.value,
          value_type: o.value_type,
          stage: o.stage,
          probability: o.probability,
        }}
      />
    </div>
  );
}

/** Sales-Board mit Linien-Filter und Phasenwechsel. */
export function SalesView({ opportunities }: { opportunities: Opportunity[] }) {
  const router = useRouter();
  const [items, setItems] = useState(opportunities);
  useEffect(() => setItems(opportunities), [opportunities]);
  const [filter, setFilter] = useState<Filter>("all");

  async function move(id: string, stage: SalesStage) {
    setItems((prev) => prev.map((o) => (o.id === id ? { ...o, stage } : o)));
    const res = await updateOpportunityStage(id, stage);
    if (res.ok && !res.demo) router.refresh();
  }

  async function onDelete(id: string) {
    const prevItems = items;
    setItems((p) => p.filter((o) => o.id !== id));
    const res = await deleteOpportunity(id);
    if (res.ok && !res.demo) {
      router.refresh();
    } else if (!res.ok) {
      setItems(prevItems);
      if (res.error) toast.error(res.error);
    }
  }

  const lost = items.filter((o) => o.stage === "verloren");
  const base = items.filter((o) => o.stage !== "verloren");
  const shown =
    filter === "verloren" ? [] : filter === "all" ? base : base.filter((o) => o.line === filter);

  return (
    <div className="space-y-4">
      <FilterTabs<Filter>
        value={filter}
        onChange={setFilter}
        options={[
          { value: "all", label: "Alle", count: base.length },
          { value: "ki", label: "KI", count: base.filter((o) => o.line === "ki").length },
          {
            value: "recruiting",
            label: "Recruiting",
            count: base.filter((o) => o.line === "recruiting").length,
          },
          ...(lost.length > 0
            ? [{ value: "verloren" as Filter, label: "Verloren", count: lost.length }]
            : []),
        ]}
      />

      {filter === "verloren" ? (
        <div className="overflow-hidden rounded-2xl border border-border bg-surface shadow-card">
          <ul className="divide-y divide-border/70">
            {lost.map((o) => (
              <li key={o.id} className="flex flex-wrap items-center gap-3 px-3 py-2.5">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-ink">{o.account_name}</p>
                  <p className="truncate text-xs text-muted">
                    {o.title} · {value(o)}
                  </p>
                </div>
                <div className="w-40">
                  <MoveSelect<SalesStage>
                    value={o.stage}
                    options={STAGE_OPTIONS}
                    onMove={(stage) => move(o.id, stage)}
                  />
                </div>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <KanbanBoard
          columns={COLUMNS}
          items={shown}
          getStage={(o) => o.stage}
          renderCard={(o) => <OppCard o={o} onMove={move} onDelete={onDelete} />}
          columnFooter={(its) => <>{formatEur(its.reduce((s, o) => s + o.value, 0))}</>}
          emptyText="Keine Verkaufschancen in diesem Filter."
        />
      )}
    </div>
  );
}
