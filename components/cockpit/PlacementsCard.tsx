"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/Badge";
import { IconCheck, IconTrash, IconPlus } from "@/components/ui/icons";
import { formatDate, formatEur } from "@/lib/format";
import {
  createPlacement,
  setPlacementStatus,
  deletePlacement,
} from "@/lib/placements-actions";
import {
  placementSplitDate,
  placementGuaranteeUntil,
  type Placement,
  type PlacementStatus,
} from "@/lib/crm-types";

const inputClass =
  "w-full rounded-xl border border-border bg-surface px-3 py-2 text-sm text-ink placeholder:text-faint focus-visible:ring-2 focus-visible:ring-brand";

const statusMeta: Record<
  PlacementStatus,
  { label: string; tone: "neutral" | "sky" | "success" | "warning" | "danger" }
> = {
  aktiv: { label: "Aktiv (in Probezeit)", tone: "sky" },
  garantie_ok: { label: "Garantie bestanden", tone: "success" },
  ausgefallen: { label: "Ausgefallen", tone: "danger" },
  nachbesetzung: { label: "Nachbesetzung läuft", tone: "warning" },
};

export function PlacementsCard({
  mandateId,
  accountName,
  role,
  defaultFee,
  candidates,
  placements,
}: {
  mandateId: string;
  accountName: string;
  role: string;
  defaultFee: number;
  candidates: { id: string; name: string }[];
  placements: Placement[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [candidateId, setCandidateId] = useState(candidates[0]?.id ?? "");
  const [startDate, setStartDate] = useState("");
  const [fee, setFee] = useState<number>(defaultFee);
  const [guarantee, setGuarantee] = useState<number>(6);

  function submit() {
    setError(null);
    const cand = candidates.find((c) => c.id === candidateId);
    start(async () => {
      const res = await createPlacement({
        candidate_id: candidateId || null,
        mandate_id: mandateId,
        candidate_name: cand?.name ?? "Kandidat:in",
        account_name: accountName,
        role,
        start_date: startDate || null,
        agreed_fee: fee,
        guarantee_months: guarantee,
      });
      if (!res.ok) {
        setError(res.error ?? "Speichern fehlgeschlagen.");
        return;
      }
      setOpen(false);
      setStartDate("");
      if (!res.demo) router.refresh();
    });
  }

  function changeStatus(id: string, status: PlacementStatus) {
    start(async () => {
      const res = await setPlacementStatus(id, status, mandateId);
      if (res.ok && !res.demo) router.refresh();
    });
  }

  function remove(id: string) {
    start(async () => {
      const res = await deletePlacement(id, mandateId);
      if (res.ok && !res.demo) router.refresh();
    });
  }

  return (
    <div className="space-y-3">
      {placements.length === 0 ? (
        <p className="text-sm text-muted">
          Noch keine Platzierung erfasst. Trage bei erfolgreicher Vermittlung das Eintrittsdatum ein –
          das CRM berechnet die 3-Monats-Honorarrate und das Garantie-Ende automatisch.
        </p>
      ) : (
        <ul className="space-y-2.5">
          {placements.map((p) => {
            const split = placementSplitDate(p);
            const guaranteeUntil = placementGuaranteeUntil(p);
            const sm = statusMeta[p.status];
            return (
              <li key={p.id} className="rounded-xl border border-border bg-elevated/40 p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-ink">{p.candidate_name}</p>
                    <p className="truncate text-xs text-faint">
                      Eintritt {p.start_date ? formatDate(p.start_date) : "—"}
                      {p.agreed_fee ? ` · ${formatEur(p.agreed_fee)} Honorar` : ""}
                    </p>
                  </div>
                  <Badge tone={sm.tone}>{sm.label}</Badge>
                </div>

                <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
                  <div className="rounded-lg bg-surface px-2.5 py-1.5">
                    <p className="text-faint">2. Rate (3 Mon.)</p>
                    <p className="font-medium text-ink">{split ? formatDate(split) : "—"}</p>
                  </div>
                  <div className="rounded-lg bg-surface px-2.5 py-1.5">
                    <p className="text-faint">Garantie bis ({p.guarantee_months} Mon.)</p>
                    <p className="font-medium text-ink">{guaranteeUntil ? formatDate(guaranteeUntil) : "—"}</p>
                  </div>
                </div>

                <div className="mt-2 flex items-center justify-between gap-2">
                  <select
                    value={p.status}
                    onChange={(e) => changeStatus(p.id, e.target.value as PlacementStatus)}
                    disabled={pending}
                    className="rounded-lg border border-border bg-surface px-2 py-1 text-xs text-ink"
                  >
                    {(Object.keys(statusMeta) as PlacementStatus[]).map((s) => (
                      <option key={s} value={s}>
                        {statusMeta[s].label}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    aria-label="Platzierung löschen"
                    onClick={() => remove(p.id)}
                    disabled={pending}
                    className="rounded-lg p-1.5 text-faint hover:bg-danger/10 hover:text-danger"
                  >
                    <IconTrash size={14} />
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {error ? <p className="text-xs text-danger">{error}</p> : null}

      {open ? (
        <div className="space-y-2.5 rounded-xl border border-border bg-surface p-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-muted">Kandidat:in</label>
            {candidates.length > 0 ? (
              <select
                value={candidateId}
                onChange={(e) => setCandidateId(e.target.value)}
                className={inputClass}
              >
                {candidates.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            ) : (
              <p className="text-xs text-faint">
                Diesem Mandat ist noch niemand zugeordnet – erst zuordnen, dann platzieren.
              </p>
            )}
          </div>
          <div className="grid grid-cols-2 gap-2.5">
            <div>
              <label className="mb-1 block text-xs font-medium text-muted">Eintrittsdatum</label>
              <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className={inputClass} />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-muted">Garantie (Monate)</label>
              <input
                type="number"
                min={0}
                value={guarantee}
                onChange={(e) => setGuarantee(Number(e.target.value) || 0)}
                className={inputClass}
              />
            </div>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-muted">Vereinbartes Honorar (€)</label>
            <input
              type="number"
              min={0}
              value={fee}
              onChange={(e) => setFee(Number(e.target.value) || 0)}
              className={inputClass}
            />
          </div>
          <div className="flex items-center justify-end gap-2">
            <button type="button" onClick={() => setOpen(false)} className="rounded-lg px-3 py-1.5 text-xs text-muted hover:text-ink">
              Abbrechen
            </button>
            <button
              type="button"
              onClick={submit}
              disabled={pending || candidates.length === 0}
              className="inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-brand to-sky px-3 py-1.5 text-xs font-semibold text-white shadow-glow active:scale-95 disabled:opacity-60"
            >
              <IconCheck size={13} /> {pending ? "speichert …" : "Platzierung speichern"}
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="inline-flex items-center gap-1.5 rounded-lg border border-brand/30 bg-brand/10 px-3 py-2 text-sm font-semibold text-brand-deep hover:bg-brand/15"
        >
          <IconPlus size={15} /> Platzierung erfassen
        </button>
      )}
    </div>
  );
}
