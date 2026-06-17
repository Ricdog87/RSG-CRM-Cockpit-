"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/Badge";
import { IconCheck, IconPencil } from "@/components/ui/icons";
import { formatDate, formatEur } from "@/lib/format";
import { updateKiProjectContract } from "@/lib/crm-actions";
import type { KiProject } from "@/lib/crm-types";

const inp = "w-full rounded-lg border border-border bg-surface px-2.5 py-1.5 text-sm text-ink";

const churnMeta: Record<string, { label: string; tone: "success" | "warning" | "danger" }> = {
  niedrig: { label: "Churn niedrig", tone: "success" },
  mittel: { label: "Churn mittel", tone: "warning" },
  hoch: { label: "Churn hoch", tone: "danger" },
};
const billingLabel: Record<string, string> = { monatlich: "monatlich", quartal: "quartalsweise", jaehrlich: "jährlich" };

function daysUntil(iso?: string): number | null {
  if (!iso) return null;
  const d = new Date(iso + "T00:00:00").getTime();
  return Math.round((d - Date.now()) / 86400000);
}

export function KiContractCard({ project }: { project: KiProject }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [edit, setEdit] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [f, setF] = useState({
    contract_start: project.contract_start ?? "",
    contract_end: project.contract_end ?? "",
    term_months: project.term_months != null ? String(project.term_months) : "",
    billing_cycle: project.billing_cycle ?? "",
    auto_renew: Boolean(project.auto_renew),
    churn_risk: project.churn_risk ?? "",
    nps: project.nps != null ? String(project.nps) : "",
    upsell_potential: project.upsell_potential ?? "",
    upsell_value: project.upsell_value != null ? String(project.upsell_value) : "",
  });

  function save() {
    setError(null);
    start(async () => {
      const res = await updateKiProjectContract(project.id, {
        contract_start: f.contract_start || null,
        contract_end: f.contract_end || null,
        term_months: f.term_months === "" ? null : Number(f.term_months),
        billing_cycle: f.billing_cycle || null,
        auto_renew: f.auto_renew,
        churn_risk: f.churn_risk || null,
        nps: f.nps === "" ? null : Number(f.nps),
        upsell_potential: f.upsell_potential || null,
        upsell_value: f.upsell_value === "" ? null : Number(f.upsell_value),
      });
      if (!res.ok) return setError(res.error ?? "Speichern fehlgeschlagen.");
      setEdit(false);
      if (res.warning) setError(res.warning);
      if (!res.demo) router.refresh();
    });
  }

  const dUntil = daysUntil(project.contract_end);
  const renewalTone = dUntil == null ? "text-faint" : dUntil < 0 ? "text-danger" : dUntil <= 60 ? "text-warning" : "text-muted";
  const cm = project.churn_risk ? churnMeta[project.churn_risk] : null;

  if (!edit) {
    return (
      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          {cm ? <Badge tone={cm.tone}>{cm.label}</Badge> : null}
          {project.auto_renew ? <Badge tone="sky">Auto-Verlängerung</Badge> : null}
          {project.nps != null ? <Badge tone="neutral">NPS {project.nps}</Badge> : null}
          <button type="button" onClick={() => setEdit(true)} aria-label="Bearbeiten"
            className="ml-auto rounded-lg p-1.5 text-faint hover:bg-elevated hover:text-ink">
            <IconPencil size={15} />
          </button>
        </div>
        <div className="grid gap-x-6 sm:grid-cols-2">
          <Row label="Laufzeit" value={[project.contract_start ? formatDate(project.contract_start) : null, project.contract_end ? formatDate(project.contract_end) : null].filter(Boolean).join(" – ") || "—"} />
          <Row label="Verlängerung in" value={dUntil == null ? "—" : <span className={renewalTone}>{dUntil < 0 ? `${Math.abs(dUntil)} T überfällig` : `${dUntil} T`}</span>} />
          <Row label="Abrechnung" value={project.billing_cycle ? billingLabel[project.billing_cycle] ?? project.billing_cycle : "—"} />
          <Row label="Vertragsdauer" value={project.term_months ? `${project.term_months} Monate` : "—"} />
          <Row label="Upsell-Potenzial" value={project.upsell_value ? `${formatEur(project.upsell_value)}/M` : "—"} />
        </div>
        {project.upsell_potential ? (
          <p className="rounded-lg border border-border bg-elevated/40 px-3 py-2 text-xs text-ink">{project.upsell_potential}</p>
        ) : null}
        {error ? <p className="text-xs text-warning">{error}</p> : null}
      </div>
    );
  }

  return (
    <div className="space-y-2.5">
      <div className="grid grid-cols-2 gap-2">
        <label className="text-[0.7rem] text-muted">Vertragsstart<input type="date" value={f.contract_start} onChange={(e) => setF({ ...f, contract_start: e.target.value })} className={inp} /></label>
        <label className="text-[0.7rem] text-muted">Vertragsende / Verlängerung<input type="date" value={f.contract_end} onChange={(e) => setF({ ...f, contract_end: e.target.value })} className={inp} /></label>
        <label className="text-[0.7rem] text-muted">Laufzeit (Monate)<input type="number" value={f.term_months} onChange={(e) => setF({ ...f, term_months: e.target.value })} className={inp} /></label>
        <label className="text-[0.7rem] text-muted">Abrechnung
          <select value={f.billing_cycle} onChange={(e) => setF({ ...f, billing_cycle: e.target.value })} className={inp}>
            <option value="">—</option><option value="monatlich">monatlich</option><option value="quartal">quartalsweise</option><option value="jaehrlich">jährlich</option>
          </select>
        </label>
        <label className="text-[0.7rem] text-muted">Churn-Risiko
          <select value={f.churn_risk} onChange={(e) => setF({ ...f, churn_risk: e.target.value })} className={inp}>
            <option value="">—</option><option value="niedrig">niedrig</option><option value="mittel">mittel</option><option value="hoch">hoch</option>
          </select>
        </label>
        <label className="text-[0.7rem] text-muted">Kunden-NPS (0–10)<input type="number" min={0} max={10} value={f.nps} onChange={(e) => setF({ ...f, nps: e.target.value })} className={inp} /></label>
        <label className="text-[0.7rem] text-muted">Upsell-Potenzial (€/Mo)<input type="number" value={f.upsell_value} onChange={(e) => setF({ ...f, upsell_value: e.target.value })} className={inp} /></label>
        <label className="flex items-center gap-2 self-end text-xs text-ink">
          <input type="checkbox" checked={f.auto_renew} onChange={(e) => setF({ ...f, auto_renew: e.target.checked })} className="h-4 w-4 accent-brand" /> Auto-Verlängerung
        </label>
      </div>
      <textarea rows={2} value={f.upsell_potential} onChange={(e) => setF({ ...f, upsell_potential: e.target.value })} placeholder="Upsell-Idee (z.B. zusätzlicher Kanal, weitere Standorte)" className={inp} />
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

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="py-2">
      <p className="text-xs text-faint">{label}</p>
      <p className="mt-0.5 text-sm text-ink">{value || "—"}</p>
    </div>
  );
}
