"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { KanbanBoard, type BoardColumn } from "@/components/cockpit/KanbanBoard";
import { MoveSelect } from "@/components/cockpit/MoveSelect";
import { IconUserCheck, IconChevronRight } from "@/components/ui/icons";
import { formatDate, formatEur } from "@/lib/format";
import { setMandateStatus } from "@/lib/crm-actions";
import {
  mandateRevenue,
  type MandateStatus,
  type RecruitingMandate,
  type Candidate,
} from "@/lib/crm-types";

const COLUMNS: BoardColumn<MandateStatus>[] = [
  { stage: "offen", label: "Offen", tone: "neutral" },
  { stage: "in_arbeit", label: "In Arbeit", tone: "sky" },
  { stage: "interviews", label: "Interviews", tone: "brand" },
  { stage: "besetzt", label: "Besetzt", tone: "success" },
  { stage: "pausiert", label: "Pausiert", tone: "warning" },
];
const OPTIONS = COLUMNS.map((c) => ({ value: c.stage, label: c.label }));

/** Kanban-Board der Mandate nach Status – Karten verschiebbar, Kunde sichtbar. */
export function MandatesBoard({
  mandates,
  candidates = [],
  renderActions,
}: {
  mandates: RecruitingMandate[];
  candidates?: Candidate[];
  renderActions?: (m: RecruitingMandate) => React.ReactNode;
}) {
  const router = useRouter();
  const [items, setItems] = useState(mandates);

  async function move(id: string, status: MandateStatus) {
    setItems((prev) => prev.map((m) => (m.id === id ? { ...m, status } : m)));
    const res = await setMandateStatus(id, status);
    if (res.ok && !res.demo) router.refresh();
  }

  return (
    <KanbanBoard<MandateStatus, RecruitingMandate>
      columns={COLUMNS}
      items={items}
      getStage={(m) => m.status}
      emptyText="Noch keine Mandate. Lege dein erstes Recruiting-Mandat an."
      columnFooter={(colItems) =>
        colItems.length > 0 ? (
          <p className="border-t border-border/50 pt-2 text-center text-[0.7rem] text-faint">
            {formatEur(colItems.reduce((s, m) => s + mandateRevenue(m), 0))} Volumen
          </p>
        ) : null
      }
      renderCard={(m) => {
        const pct = m.positions > 0 ? Math.round((m.filled / m.positions) * 100) : 0;
        const offen = Math.max(0, m.positions - m.filled);
        const perPos = m.positions > 0 ? mandateRevenue(m) / m.positions : 0;
        const mandateCands = candidates.filter(
          (c) => c.mandate_id === m.id || c.mandate_account === m.account_name
        );
        return (
          <div className="rounded-xl border border-border bg-surface p-3 shadow-sm">
            <div className="flex items-start justify-between gap-2">
              <Link href={`/cockpit/projekte/recruiting/${m.id}`} className="group min-w-0">
                <p className="truncate text-sm font-semibold text-ink group-hover:text-brand-deep group-hover:underline">
                  {m.role || "Mandat"}
                </p>
                <p className="truncate text-xs text-faint">{m.account_name}</p>
              </Link>
              {renderActions ? <div className="flex-none">{renderActions(m)}</div> : null}
            </div>

            {m.job_posting ? (
              <span className="mt-1.5 inline-block rounded-full bg-sky/10 px-2 py-0.5 text-[0.6rem] font-medium text-sky-deep">
                Anzeige hinterlegt
              </span>
            ) : null}

            <div className="mt-2 space-y-1">
              <div className="flex items-center justify-between text-[0.7rem]">
                <span className="text-faint">Besetzung</span>
                <span className="text-muted">{m.filled}/{m.positions}</span>
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-elevated">
                <div className="h-full rounded-full bg-gradient-to-r from-brand to-sky" style={{ width: `${pct}%` }} />
              </div>
            </div>

            <div className="mt-2 flex items-center justify-between text-xs">
              <Link
                href={`/cockpit/projekte/recruiting/${m.id}`}
                className="inline-flex items-center gap-1 text-muted hover:text-ink"
              >
                <IconUserCheck size={13} className="text-faint" /> {mandateCands.length}
                <IconChevronRight size={11} className="text-faint" />
              </Link>
              <span className="font-semibold text-ink">{formatEur(offen * perPos)} offen</span>
            </div>

            <p className="mt-1 text-[0.65rem] text-faint">bis {formatDate(m.deadline)}</p>

            <MoveSelect<MandateStatus> value={m.status} options={OPTIONS} onMove={(s) => move(m.id, s)} />
          </div>
        );
      }}
    />
  );
}
