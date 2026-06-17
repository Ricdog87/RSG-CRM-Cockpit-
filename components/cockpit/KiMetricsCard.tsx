"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { IconTrash, IconCheck, IconPlus } from "@/components/ui/icons";
import { formatEur } from "@/lib/format";
import { upsertMetric, deleteMetric } from "@/lib/ki-metrics-actions";
import type { KiMetric } from "@/lib/ki-metrics-data";

const inp = "w-full rounded-lg border border-border bg-surface px-2.5 py-1.5 text-sm text-ink";

function pct(v?: number): string {
  return v == null ? "—" : `${Math.round(v)} %`;
}
function thisMonth(): string {
  return new Date().toISOString().slice(0, 7);
}

export function KiMetricsCard({
  projectId,
  metrics,
}: {
  projectId: string;
  metrics: KiMetric[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const latest = metrics[0];
  const [form, setForm] = useState({
    period: thisMonth(),
    calls: "",
    automation_rate: "",
    containment_rate: "",
    escalations: "",
    uptime: "",
    token_cost: "",
    csat: "",
  });

  function num(v: string): number | null {
    return v === "" ? null : Number(v);
  }

  function save() {
    setError(null);
    start(async () => {
      const res = await upsertMetric({
        project_id: projectId,
        period: form.period,
        calls: num(form.calls),
        automation_rate: num(form.automation_rate),
        containment_rate: num(form.containment_rate),
        escalations: num(form.escalations),
        uptime: num(form.uptime),
        token_cost: num(form.token_cost),
        csat: num(form.csat),
      });
      if (!res.ok) return setError(res.error ?? "Speichern fehlgeschlagen.");
      setOpen(false);
      if (!res.demo) router.refresh();
    });
  }
  function remove(id: string) {
    start(async () => {
      const res = await deleteMetric(id, projectId);
      if (res.ok && !res.demo) router.refresh();
    });
  }

  return (
    <div className="space-y-3">
      {/* Aktuelle Kennzahlen */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {[
          { label: "Automatisierung", value: pct(latest?.automation_rate) },
          { label: "Containment", value: pct(latest?.containment_rate) },
          { label: "Anrufe/Mo", value: latest?.calls != null ? String(latest.calls) : "—" },
          { label: "Token-Kosten", value: latest?.token_cost != null ? formatEur(latest.token_cost) : "—" },
          { label: "Uptime", value: pct(latest?.uptime) },
          { label: "Eskalationen", value: latest?.escalations != null ? String(latest.escalations) : "—" },
          { label: "CSAT", value: latest?.csat != null ? `${Math.round(latest.csat)}` : "—" },
          { label: "Stand", value: latest?.period ?? "—" },
        ].map((k) => (
          <div key={k.label} className="rounded-xl border border-border bg-elevated/40 px-3 py-2">
            <p className="text-[0.65rem] uppercase tracking-wide text-faint">{k.label}</p>
            <p className="mt-0.5 text-base font-bold text-ink">{k.value}</p>
          </div>
        ))}
      </div>

      {error ? <p className="text-xs text-danger">{error}</p> : null}

      {/* Monatsverlauf */}
      {metrics.length > 0 ? (
        <div className="overflow-hidden rounded-xl border border-border">
          <div className="grid grid-cols-12 gap-2 border-b border-border bg-elevated/40 px-3 py-1.5 text-[0.6rem] font-semibold uppercase tracking-wider text-faint">
            <span className="col-span-3">Monat</span>
            <span className="col-span-2 text-right">Auto.</span>
            <span className="col-span-2 text-right">Contain.</span>
            <span className="col-span-2 text-right">Anrufe</span>
            <span className="col-span-2 text-right">Token €</span>
            <span className="col-span-1" />
          </div>
          <ul className="divide-y divide-border">
            {metrics.slice(0, 6).map((m) => (
              <li key={m.id} className="grid grid-cols-12 items-center gap-2 px-3 py-1.5 text-xs">
                <span className="col-span-3 font-medium text-ink">{m.period}</span>
                <span className="col-span-2 text-right text-muted">{pct(m.automation_rate)}</span>
                <span className="col-span-2 text-right text-muted">{pct(m.containment_rate)}</span>
                <span className="col-span-2 text-right text-muted">{m.calls ?? "—"}</span>
                <span className="col-span-2 text-right text-muted">{m.token_cost != null ? formatEur(m.token_cost) : "—"}</span>
                <button type="button" aria-label="löschen" onClick={() => remove(m.id)} disabled={pending}
                  className="col-span-1 justify-self-end rounded p-1 text-faint hover:bg-danger/10 hover:text-danger">
                  <IconTrash size={12} />
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="text-sm text-muted">Noch keine Betriebskennzahlen. Trage den ersten Monat ein – Health wird so objektiv.</p>
      )}

      {/* Eingabe */}
      {open ? (
        <div className="space-y-2 rounded-xl border border-border bg-surface p-3">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <label className="text-[0.7rem] text-muted">Monat<input type="month" value={form.period} onChange={(e) => setForm({ ...form, period: e.target.value })} className={inp} /></label>
            <label className="text-[0.7rem] text-muted">Anrufe<input type="number" value={form.calls} onChange={(e) => setForm({ ...form, calls: e.target.value })} className={inp} /></label>
            <label className="text-[0.7rem] text-muted">Automatis. %<input type="number" value={form.automation_rate} onChange={(e) => setForm({ ...form, automation_rate: e.target.value })} className={inp} /></label>
            <label className="text-[0.7rem] text-muted">Containment %<input type="number" value={form.containment_rate} onChange={(e) => setForm({ ...form, containment_rate: e.target.value })} className={inp} /></label>
            <label className="text-[0.7rem] text-muted">Eskalationen<input type="number" value={form.escalations} onChange={(e) => setForm({ ...form, escalations: e.target.value })} className={inp} /></label>
            <label className="text-[0.7rem] text-muted">Uptime %<input type="number" value={form.uptime} onChange={(e) => setForm({ ...form, uptime: e.target.value })} className={inp} /></label>
            <label className="text-[0.7rem] text-muted">Token-Kosten €<input type="number" value={form.token_cost} onChange={(e) => setForm({ ...form, token_cost: e.target.value })} className={inp} /></label>
            <label className="text-[0.7rem] text-muted">CSAT (0–100)<input type="number" value={form.csat} onChange={(e) => setForm({ ...form, csat: e.target.value })} className={inp} /></label>
          </div>
          <div className="flex items-center justify-end gap-2">
            <button type="button" onClick={() => setOpen(false)} className="rounded-lg px-2.5 py-1 text-xs text-muted hover:text-ink">Abbrechen</button>
            <button type="button" onClick={save} disabled={pending}
              className="inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-brand to-sky px-3 py-1.5 text-xs font-semibold text-white shadow-glow disabled:opacity-60">
              <IconCheck size={12} /> {pending ? "…" : "Monat speichern"}
            </button>
          </div>
        </div>
      ) : (
        <button type="button" onClick={() => setOpen(true)}
          className="inline-flex items-center gap-1.5 rounded-lg border border-brand/30 bg-brand/10 px-2.5 py-1.5 text-xs font-semibold text-brand-deep hover:bg-brand/15">
          <IconPlus size={13} /> Monatswerte erfassen
        </button>
      )}
    </div>
  );
}
