"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { KanbanBoard, type BoardColumn } from "@/components/cockpit/KanbanBoard";
import { LineBadge } from "@/components/cockpit/LineBadge";
import { MoveSelect } from "@/components/cockpit/MoveSelect";
import { OppScore } from "@/components/cockpit/OppScore";
import { FilterTabs } from "@/components/ui/FilterTabs";
import { updateOpportunityStage } from "@/lib/crm-actions";
import { formatDate, formatEur, formatPercent } from "@/lib/format";
import type { BusinessLine, Opportunity, SalesStage } from "@/lib/crm-types";

type Filter = "all" | BusinessLine;

const COLUMNS: BoardColumn<SalesStage>[] = [
  { stage: "neu", label: "Neu", tone: "neutral" },
  { stage: "qualifiziert", label: "Qualifiziert", tone: "sky" },
  { stage: "demo", label: "Demo/Termin", tone: "sky" },
  { stage: "angebot", label: "Angebot", tone: "brand" },
  { stage: "verhandlung", label: "Verhandlung", tone: "brand" },
  { stage: "gewonnen", label: "Gewonnen", tone: "success" },
];

const STAGE_OPTIONS = COLUMNS.map((c) => ({ value: c.stage, label: c.label }));

function value(o: Opportunity) {
  return o.value_type === "mrr" ? `${formatEur(o.value)}/M` : formatEur(o.value);
}

function OppCard({
  o,
  onMove,
}: {
  o: Opportunity;
  onMove: (id: string, stage: SalesStage) => void;
}) {
  return (
    <div className="rounded-xl border border-border bg-elevated/50 p-3 transition-colors hover:border-brand/40">
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <p className="truncate text-sm font-medium text-ink">{o.account_name}</p>
        <LineBadge line={o.line} />
      </div>
      <p className="truncate text-xs text-muted">{o.title}</p>
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
  const [filter, setFilter] = useState<Filter>("all");

  async function move(id: string, stage: SalesStage) {
    setItems((prev) => prev.map((o) => (o.id === id ? { ...o, stage } : o)));
    const res = await updateOpportunityStage(id, stage);
    if (res.ok && !res.demo) router.refresh();
  }

  const base = items.filter((o) => o.stage !== "verloren");
  const shown = filter === "all" ? base : base.filter((o) => o.line === filter);

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
        ]}
      />
      <KanbanBoard
        columns={COLUMNS}
        items={shown}
        getStage={(o) => o.stage}
        renderCard={(o) => <OppCard o={o} onMove={move} />}
        columnFooter={(its) => <>{formatEur(its.reduce((s, o) => s + o.value, 0))}</>}
        emptyText="Keine Verkaufschancen in diesem Filter."
      />
    </div>
  );
}
