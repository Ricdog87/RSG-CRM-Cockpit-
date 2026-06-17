"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/Badge";
import { Card, CardBody } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { MoveSelect } from "@/components/cockpit/MoveSelect";
import { IconUserCheck, IconChevronRight, IconLayers } from "@/components/ui/icons";
import { cn } from "@/components/ui/cn";
import { formatDate, formatEur } from "@/lib/format";
import { setMandateStatus } from "@/lib/crm-actions";
import {
  mandateRevenue,
  type MandateStatus,
  type RecruitingMandate,
  type Candidate,
} from "@/lib/crm-types";

const COLUMNS: { stage: MandateStatus; label: string; tone: "neutral" | "sky" | "brand" | "success" | "warning" }[] = [
  { stage: "angebot", label: "Angebot / Planung", tone: "neutral" },
  { stage: "offen", label: "Offen", tone: "neutral" },
  { stage: "in_arbeit", label: "In Arbeit", tone: "sky" },
  { stage: "interviews", label: "Interviews", tone: "brand" },
  { stage: "besetzt", label: "Besetzt", tone: "success" },
  { stage: "pausiert", label: "Pausiert", tone: "warning" },
];
const OPTIONS = COLUMNS.map((c) => ({ value: c.stage, label: c.label }));

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
  const [dragId, setDragId] = useState<string | null>(null);
  const [overStatus, setOverStatus] = useState<MandateStatus | null>(null);
  const [preview, setPreview] = useState<{ x: number; y: number; label: string } | null>(null);
  const dragRef = useRef<{ id: string; from: MandateStatus } | null>(null);
  const overRef = useRef<MandateStatus | null>(null);

  async function move(id: string, status: MandateStatus) {
    const cur = items.find((m) => m.id === id);
    if (!cur || cur.status === status) return;
    setItems((prev) => prev.map((m) => (m.id === id ? { ...m, status } : m)));
    const res = await setMandateStatus(id, status);
    if (res.ok && !res.demo) router.refresh();
  }

  function onHandleDown(e: React.PointerEvent, m: RecruitingMandate) {
    e.preventDefault();
    e.stopPropagation();
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
    dragRef.current = { id: m.id, from: m.status };
    overRef.current = null;
    setDragId(m.id);
    setOverStatus(null);
    setPreview({ x: e.clientX, y: e.clientY, label: `${m.role || "Mandat"} · ${m.account_name}` });
  }

  function onHandleMove(e: React.PointerEvent) {
    if (!dragRef.current) return;
    setPreview((p) => (p ? { ...p, x: e.clientX, y: e.clientY } : p));
    const el = document.elementFromPoint(e.clientX, e.clientY);
    const col = el?.closest("[data-status]");
    const status = (col?.getAttribute("data-status") as MandateStatus | null) ?? null;
    if (status !== overRef.current) {
      overRef.current = status;
      setOverStatus(status);
    }
  }

  function onHandleUp() {
    const drag = dragRef.current;
    const over = overRef.current;
    dragRef.current = null;
    overRef.current = null;
    setDragId(null);
    setOverStatus(null);
    setPreview(null);
    if (drag && over && over !== drag.from) void move(drag.id, over);
  }

  if (items.length === 0) {
    return (
      <Card>
        <CardBody>
          <EmptyState title="Noch keine Mandate. Lege dein erstes Recruiting-Mandat an." />
        </CardBody>
      </Card>
    );
  }

  return (
    <>
      <div className="-mx-1 flex gap-4 overflow-x-auto px-1 pb-2 xl:overflow-visible">
        {COLUMNS.map((col) => {
          const colItems = items.filter((m) => m.status === col.stage);
          const volume = colItems.reduce((s, m) => s + mandateRevenue(m), 0);
          return (
            <div
              key={col.stage}
              data-status={col.stage}
              className={cn(
                "flex w-72 flex-none flex-col gap-3 rounded-2xl border bg-surface/40 p-4 transition-colors xl:w-auto xl:flex-1",
                overStatus === col.stage && dragId ? "border-brand bg-brand/[0.04] ring-2 ring-brand/30" : "border-border/60"
              )}
            >
              <div className="flex items-center justify-between">
                <Badge tone={col.tone}>{col.label}</Badge>
                <span className="text-xs font-medium text-faint">{colItems.length}</span>
              </div>
              <div className="space-y-2.5">
                {colItems.length === 0 ? (
                  <p className="rounded-lg border border-dashed border-border/60 px-1 py-5 text-center text-xs text-faint">
                    hierher ziehen
                  </p>
                ) : (
                  colItems.map((m) => {
                    const pct = m.positions > 0 ? Math.round((m.filled / m.positions) * 100) : 0;
                    const offen = Math.max(0, m.positions - m.filled);
                    const perPos = m.positions > 0 ? mandateRevenue(m) / m.positions : 0;
                    const cands = candidates.filter(
                      (c) => c.mandate_id === m.id || c.mandate_account === m.account_name
                    ).length;
                    return (
                      <div
                        key={m.id}
                        className={cn(
                          "rounded-xl border border-border bg-surface p-3 shadow-sm transition-opacity",
                          dragId === m.id && "opacity-40"
                        )}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <button
                            type="button"
                            aria-label="Zum Verschieben ziehen"
                            onPointerDown={(e) => onHandleDown(e, m)}
                            onPointerMove={onHandleMove}
                            onPointerUp={onHandleUp}
                            onPointerCancel={onHandleUp}
                            className="mt-0.5 flex-none cursor-grab touch-none rounded p-0.5 text-faint hover:text-ink active:cursor-grabbing"
                          >
                            <IconLayers size={14} />
                          </button>
                          <Link href={`/cockpit/projekte/recruiting/${m.id}`} className="group min-w-0 flex-1">
                            <p className="truncate text-sm font-semibold text-ink group-hover:text-brand-deep group-hover:underline">
                              {m.role || "Mandat"}
                            </p>
                            <p className="truncate text-xs text-faint">{m.account_name}</p>
                          </Link>
                          {renderActions ? <div className="flex-none">{renderActions(m)}</div> : null}
                        </div>

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
                          <Link href={`/cockpit/projekte/recruiting/${m.id}`} className="inline-flex items-center gap-1 text-muted hover:text-ink">
                            <IconUserCheck size={13} className="text-faint" /> {cands}
                            <IconChevronRight size={11} className="text-faint" />
                          </Link>
                          <span className="font-semibold text-ink">{formatEur(offen * perPos)} offen</span>
                        </div>

                        <p className="mt-1 text-[0.65rem] text-faint">bis {formatDate(m.deadline)}</p>

                        <MoveSelect<MandateStatus> value={m.status} options={OPTIONS} onMove={(s) => move(m.id, s)} />
                      </div>
                    );
                  })
                )}
              </div>
              {colItems.length > 0 ? (
                <p className="border-t border-border/50 pt-2 text-center text-[0.7rem] text-faint">
                  {formatEur(volume)} Volumen
                </p>
              ) : null}
            </div>
          );
        })}
      </div>

      {/* Schwebende Vorschau beim Ziehen */}
      {preview ? (
        <div
          className="pointer-events-none fixed z-[80] max-w-[14rem] -translate-x-1/2 -translate-y-1/2 rounded-xl border border-brand bg-surface px-3 py-2 text-xs font-medium text-ink shadow-card"
          style={{ left: preview.x, top: preview.y }}
        >
          {preview.label}
        </div>
      ) : null}
    </>
  );
}
