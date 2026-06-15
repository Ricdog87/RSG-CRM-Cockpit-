"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { KanbanBoard, type BoardColumn } from "@/components/cockpit/KanbanBoard";
import { MoveSelect } from "@/components/cockpit/MoveSelect";
import { EditDialog } from "@/components/cockpit/EditDialog";
import { RowActions } from "@/components/cockpit/RowActions";
import { FilterTabs } from "@/components/ui/FilterTabs";
import { IconMail, IconPhone, IconFolder } from "@/components/ui/icons";
import { CANDIDATE_FIELDS, withDatalist } from "@/lib/crm-forms";
import { updateCandidateStage, updateCandidate, deleteCandidate } from "@/lib/crm-actions";
import { cvSignedUrl } from "@/lib/cv-actions";
import { formatDate } from "@/lib/format";
import type { FormField } from "@/components/cockpit/EntityFormDialog";
import type { Candidate, CandidateStage } from "@/lib/crm-types";

const COLUMNS: BoardColumn<CandidateStage>[] = [
  { stage: "neu", label: "Neu", tone: "neutral" },
  { stage: "screening", label: "Screening", tone: "sky" },
  { stage: "interview", label: "Interview", tone: "brand" },
  { stage: "angebot", label: "Angebot", tone: "brand" },
  { stage: "platziert", label: "Platziert", tone: "success" },
];

const STAGE_OPTIONS = COLUMNS.map((c) => ({ value: c.stage, label: c.label }));

function CvLink({ path }: { path: string }) {
  const [loading, setLoading] = useState(false);
  async function open() {
    setLoading(true);
    try {
      const res = await cvSignedUrl(path);
      if (res.ok && res.url) window.open(res.url, "_blank", "noopener,noreferrer");
    } finally {
      setLoading(false);
    }
  }
  return (
    <button
      type="button"
      onClick={open}
      disabled={loading}
      className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[0.7rem] font-medium text-brand transition-colors hover:bg-brand/10 disabled:opacity-60"
      title="CV öffnen"
    >
      <IconFolder size={12} /> {loading ? "öffne …" : "CV"}
    </button>
  );
}

function CandidateCard({
  c,
  onMove,
  onDelete,
  editFields,
}: {
  c: Candidate;
  onMove: (id: string, stage: CandidateStage) => void;
  onDelete: (id: string) => void;
  editFields: FormField[];
}) {
  return (
    <div className="rounded-xl border border-border bg-elevated/50 p-3 transition-colors hover:border-brand/40">
      <div className="flex items-start justify-between gap-1">
        <Link
          href={`/cockpit/kandidaten/${c.id}`}
          className="group min-w-0"
          title="Profil öffnen"
        >
          <p className="truncate text-sm font-medium text-ink group-hover:text-brand-deep group-hover:underline">
            {c.name}
          </p>
          <p className="truncate text-xs text-muted">{c.role}</p>
        </Link>
        <RowActions
          confirmText={`„${c.name}" wirklich löschen?`}
          onDelete={() => onDelete(c.id)}
          editNode={
            <EditDialog
              id={c.id}
              title="Kandidat:in bearbeiten"
              fields={editFields}
              action={updateCandidate}
              initial={{
                name: c.name,
                role: c.role,
                email: c.email ?? "",
                phone: c.phone ?? "",
                mandate_account: c.mandate_account,
                stage: c.stage,
                source: c.source,
              }}
            />
          }
        />
      </div>

      {c.email || c.phone ? (
        <div className="mt-2 space-y-0.5">
          {c.email ? (
            <a
              href={`mailto:${c.email}`}
              className="flex items-center gap-1.5 truncate text-xs text-muted hover:text-brand"
            >
              <IconMail size={12} /> <span className="truncate">{c.email}</span>
            </a>
          ) : null}
          {c.phone ? (
            <a
              href={`tel:${c.phone.replace(/\s+/g, "")}`}
              className="flex items-center gap-1.5 truncate text-xs text-muted hover:text-brand"
            >
              <IconPhone size={12} /> <span className="truncate">{c.phone}</span>
            </a>
          ) : null}
        </div>
      ) : null}

      <p className="mt-2 truncate text-xs text-faint">{c.mandate_account}</p>
      <div className="mt-2 flex items-center justify-between text-[0.7rem] text-faint">
        <span className="flex items-center gap-1.5">
          <span className="truncate">{c.source}</span>
          {c.cv_path ? <CvLink path={c.cv_path} /> : null}
        </span>
        <span>{formatDate(c.updated_at)}</span>
      </div>
      <MoveSelect<CandidateStage>
        value={c.stage}
        options={STAGE_OPTIONS}
        onMove={(stage) => onMove(c.id, stage)}
      />
    </div>
  );
}

/** Kandidaten-Board mit Mandats-Filter und Phasenwechsel. */
export function CandidatesView({
  candidates,
  accountNames = [],
}: {
  candidates: Candidate[];
  accountNames?: string[];
}) {
  const router = useRouter();
  const [items, setItems] = useState(candidates);
  const [filter, setFilter] = useState<string>("all");
  const editFields = withDatalist(CANDIDATE_FIELDS, "mandate_account", accountNames);

  async function move(id: string, stage: CandidateStage) {
    setItems((prev) => prev.map((c) => (c.id === id ? { ...c, stage } : c)));
    const res = await updateCandidateStage(id, stage);
    if (res.ok && !res.demo) router.refresh();
  }

  async function onDelete(id: string) {
    setItems((prev) => prev.filter((c) => c.id !== id));
    const res = await deleteCandidate(id);
    if (res.ok && !res.demo) router.refresh();
  }

  const mandates = Array.from(new Set(items.map((c) => c.mandate_account)));
  const base = items.filter((c) => c.stage !== "abgelehnt");
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
        renderCard={(c) => (
          <CandidateCard c={c} onMove={move} onDelete={onDelete} editFields={editFields} />
        )}
        emptyText="Keine Kandidat:innen in diesem Filter."
      />
    </div>
  );
}
