"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { KanbanBoard, type BoardColumn } from "@/components/cockpit/KanbanBoard";
import { MoveSelect } from "@/components/cockpit/MoveSelect";
import { updateCandidateStage } from "@/lib/crm-actions";
import type { Candidate, CandidateStage } from "@/lib/crm-types";

const COLUMNS: BoardColumn<CandidateStage>[] = [
  { stage: "neu", label: "Neu", tone: "neutral" },
  { stage: "screening", label: "Screening", tone: "sky" },
  { stage: "interview", label: "Interview", tone: "brand" },
  { stage: "angebot", label: "Angebot", tone: "brand" },
  { stage: "platziert", label: "Platziert", tone: "success" },
];
const OPTIONS = COLUMNS.map((c) => ({ value: c.stage, label: c.label }));

function initials(name: string): string {
  return name.split(" ").map((p) => p[0]).filter(Boolean).slice(0, 2).join("").toUpperCase();
}

/** Mini-Kanban der einem Mandat zugeordneten Kandidat:innen, nach Phase. */
export function MandateCandidates({ candidates }: { candidates: Candidate[] }) {
  const router = useRouter();
  const [items, setItems] = useState(candidates);

  async function move(id: string, stage: CandidateStage) {
    setItems((p) => p.map((c) => (c.id === id ? { ...c, stage } : c)));
    const res = await updateCandidateStage(id, stage);
    if (res.ok && !res.demo) router.refresh();
  }

  return (
    <KanbanBoard
      columns={COLUMNS}
      items={items}
      getStage={(c) => c.stage}
      emptyText="Noch keine Kandidat:innen diesem Mandat zugeordnet. Ordne sie im Kandidatenprofil zu."
      renderCard={(c) => (
        <div className="rounded-xl border border-border bg-surface p-3 shadow-sm">
          <div className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 flex-none items-center justify-center rounded-full bg-gradient-to-br from-brand to-sky text-xs font-bold text-white">
              {initials(c.name) || "?"}
            </span>
            <Link href={`/cockpit/kandidaten/${c.id}`} className="group min-w-0">
              <p className="truncate text-sm font-semibold text-ink group-hover:text-brand-deep group-hover:underline">
                {c.name}
              </p>
              <p className="truncate text-xs text-muted">{c.role || "Position offen"}</p>
            </Link>
          </div>
          <MoveSelect<CandidateStage>
            value={c.stage}
            options={OPTIONS}
            onMove={(stage) => move(c.id, stage)}
          />
        </div>
      )}
    />
  );
}
