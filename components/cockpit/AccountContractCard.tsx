"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/Badge";
import { IconCheck, IconPencil } from "@/components/ui/icons";
import { formatDate } from "@/lib/format";
import { updateAccountContract, markContractSigned } from "@/lib/crm-actions";
import type { Account } from "@/lib/crm-types";

const inputClass =
  "w-full rounded-lg border border-border bg-surface px-2.5 py-1.5 text-sm text-ink focus-visible:ring-2 focus-visible:ring-brand";

const engagement: Record<string, string> = {
  exklusiv: "Exklusiv",
  nicht_exklusiv: "Nicht-exklusiv",
  retainer: "Retainer",
};
const contractMeta: Record<string, { label: string; tone: "neutral" | "sky" | "success" }> = {
  kein: { label: "Kein Vertrag", tone: "neutral" },
  versendet: { label: "Versendet", tone: "sky" },
  unterzeichnet: { label: "Unterzeichnet", tone: "success" },
};

export function AccountContractCard({ account }: { account: Account }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [edit, setEdit] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [eng, setEng] = useState<string>(account.engagement_type ?? "");
  const [status, setStatus] = useState<string>(account.contract_status ?? "kein");
  const [signed, setSigned] = useState<string>(account.contract_signed_at ?? "");
  const [fee, setFee] = useState<string>(account.fee_agreement ?? "");

  function save() {
    setError(null);
    start(async () => {
      const res = await updateAccountContract(account.id, {
        engagement_type: eng,
        contract_status: status,
        contract_signed_at: signed || null,
        fee_agreement: fee || null,
      });
      if (!res.ok) return setError(res.error ?? "Speichern fehlgeschlagen.");
      setEdit(false);
      if (res.warning) setError(res.warning);
      if (!res.demo) router.refresh();
    });
  }

  const cm = contractMeta[account.contract_status ?? "kein"] ?? contractMeta.kein;
  const [note, setNote] = useState<string | null>(null);

  function signNow() {
    setError(null);
    setNote(null);
    start(async () => {
      const res = await markContractSigned(account.id);
      if (!res.ok) return setError(res.error ?? "Fehlgeschlagen.");
      setNote(
        res.activated && res.activated > 0
          ? `Vertrag unterschrieben · ${res.activated} Mandat(e) aktiviert.`
          : "Vertrag als unterschrieben markiert."
      );
      if (!res.demo) router.refresh();
    });
  }

  if (!edit) {
    return (
      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={cm.tone}>{cm.label}</Badge>
          {account.engagement_type ? <Badge tone="neutral">{engagement[account.engagement_type]}</Badge> : null}
          {account.contract_signed_at ? (
            <span className="text-xs text-faint">seit {formatDate(account.contract_signed_at)}</span>
          ) : null}
          <button
            type="button"
            onClick={() => setEdit(true)}
            className="ml-auto inline-flex items-center gap-1 rounded-lg p-1.5 text-faint hover:bg-elevated hover:text-ink"
            aria-label="Bearbeiten"
          >
            <IconPencil size={15} />
          </button>
        </div>

        {account.contract_status !== "unterzeichnet" && !account.synthetic ? (
          <button
            type="button"
            onClick={signNow}
            disabled={pending}
            className="inline-flex items-center gap-1.5 rounded-lg border border-success/40 bg-success/10 px-3 py-1.5 text-sm font-semibold text-success transition-colors hover:bg-success/15 disabled:opacity-60"
          >
            <IconCheck size={14} /> {pending ? "…" : "Vertrag unterschrieben"}
          </button>
        ) : null}
        {note ? <p className="text-xs text-success">{note}</p> : null}
        {account.fee_agreement ? (
          <p className="whitespace-pre-line rounded-lg border border-border bg-elevated/40 px-3 py-2 text-xs text-ink">
            {account.fee_agreement}
          </p>
        ) : (
          <p className="text-sm text-muted">
            Noch keine Honorarvereinbarung hinterlegt – Mandatsart, Vertragsstatus und Konditionen erfassen.
          </p>
        )}
        {error ? <p className="text-xs text-warning">{error}</p> : null}
      </div>
    );
  }

  return (
    <div className="space-y-2.5">
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="mb-1 block text-[0.7rem] font-medium text-muted">Mandatsart</label>
          <select value={eng} onChange={(e) => setEng(e.target.value)} className={inputClass}>
            <option value="">—</option>
            <option value="exklusiv">Exklusiv</option>
            <option value="nicht_exklusiv">Nicht-exklusiv</option>
            <option value="retainer">Retainer</option>
          </select>
        </div>
        <div>
          <label className="mb-1 block text-[0.7rem] font-medium text-muted">Vertragsstatus</label>
          <select value={status} onChange={(e) => setStatus(e.target.value)} className={inputClass}>
            <option value="kein">Kein Vertrag</option>
            <option value="versendet">Versendet</option>
            <option value="unterzeichnet">Unterzeichnet</option>
          </select>
        </div>
      </div>
      <div>
        <label className="mb-1 block text-[0.7rem] font-medium text-muted">Unterzeichnet am</label>
        <input type="date" value={signed} onChange={(e) => setSigned(e.target.value)} className={inputClass} />
      </div>
      <div>
        <label className="mb-1 block text-[0.7rem] font-medium text-muted">Honorarvereinbarung / Konditionen</label>
        <textarea rows={3} value={fee} onChange={(e) => setFee(e.target.value)} placeholder="z.B. 25 % vom Bruttojahreszielgehalt, 6 Monate Garantie, Zahlungsziel 14 Tage …" className={inputClass} />
      </div>
      {error ? <p className="text-xs text-danger">{error}</p> : null}
      <div className="flex items-center justify-end gap-2">
        <button type="button" onClick={() => setEdit(false)} className="rounded-lg px-2.5 py-1 text-xs text-muted hover:text-ink">Abbrechen</button>
        <button type="button" onClick={save} disabled={pending}
          className="inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-brand to-sky px-3 py-1.5 text-xs font-semibold text-white shadow-glow disabled:opacity-60">
          <IconCheck size={12} /> {pending ? "…" : "Speichern"}
        </button>
      </div>
    </div>
  );
}
