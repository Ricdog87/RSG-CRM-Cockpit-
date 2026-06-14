"use client";

import { useState } from "react";
import { KanbanBoard, type BoardColumn } from "@/components/cockpit/KanbanBoard";
import { FilterTabs } from "@/components/ui/FilterTabs";
import { formatDate } from "@/lib/format";
import type { Candidate, CandidateStage } from "@/lib/crm-types";

const COLUMNS: BoardColumn<CandidateStage>[] = [
  { stage: "neu", label: "Neu", tone: "neutral" },
  { stage: "screening", label: "Screening", tone: "sky" },
  { stage: "interview", label: "Interview", tone: "brand" },
  { stage: "angebot", label: "Angebot", tone: "brand" },
  { stage: "platziert", label: "Platziert", tone: "success" },
];

function CandidateCard({ c }: { c: Candidate }) {
  return (
    <div className="rounded-xl border border-border bg-elevated/50 p-3 transition-colors hover:border-brand/40">
      <p className="truncate text-sm font-medium text-ink">{c.name}</p>
      <p className="truncate text-xs text-muted">{c.role}</p>
      <p className="mt-2 truncate text-xs text-faint">{c.mandate_account}</p>
      <div className="mt-2 flex items-center justify-between text-[0.7rem] text-faint">
        <span>{c.source}</span>
        <span>{formatDate(c.updated_at)}</span>
      </div>
    </div>
  );
}

/** Kandidaten-Board mit Filter nach Mandat. */
export function CandidatesView({ candidates }: { candidates: Candidate[] }) {
  const mandates = Array.from(new Set(candidates.map((c) => c.mandate_account)));
  const [filter, setFilter] = useState<string>("all");

  const base = candidates.filter((c) => c.stage !== "abgelehnt");
  const shown = filter === "all" ? base : base.filter((c) => c.mandate_account === filter);

  return (
    <div className="space-y-4">
      <FilterTabs<string>
        value={filter}
        onChange={setFilter}
        options={[
          { value: "all", label: "Alle Mandate", count: base.length },
          ...mandates.map((m) => ({
            value: m,
            label: m,
            count: base.filter((c) => c.mandate_account === m).length,
          })),
        ]}
      />
      <KanbanBoard
        columns={COLUMNS}
        items={shown}
        getStage={(c) => c.stage}
        renderCard={(c) => <CandidateCard c={c} />}
        emptyText="Keine Kandidat:innen in diesem Filter."
      />
    </div>
  );
}
