"use client";

import { useState } from "react";
import { Card, CardBody, SectionHeader } from "@/components/ui/Card";
import { IconBolt, IconChevronRight } from "@/components/ui/icons";
import { formatEur } from "@/lib/format";

function NumField({ label, value, onChange, suffix }: { label: string; value: number; onChange: (n: number) => void; suffix?: string }) {
  return (
    <label className="block">
      <span className="kpi-label">{label}</span>
      <span className="mt-1 flex items-center gap-2">
        <input
          type="number"
          min={0}
          value={Number.isFinite(value) ? value : 0}
          onChange={(e) => onChange(Number(e.target.value))}
          className="w-full rounded-lg border border-border bg-surface px-2.5 py-1.5 text-sm text-ink focus-visible:ring-2 focus-visible:ring-brand"
        />
        {suffix ? <span className="text-xs text-faint">{suffix}</span> : null}
      </span>
    </label>
  );
}

/**
 * KI-ROI-Rechner für die Telefonassistenz-Akquise (RSG AI). Zeigt entgangenen
 * Umsatz durch verpasste Anrufe und den ROI der KI-Lösung. Rein clientseitig.
 */
export function KiRoiCalculator() {
  const [open, setOpen] = useState(false);
  const [callsPerMonth, setCalls] = useState(300);
  const [missedPct, setMissed] = useState(25);
  const [conversionPct, setConversion] = useState(20);
  const [dealValue, setDealValue] = useState(450);
  const [recoverPct, setRecover] = useState(70);
  const [kiPrice, setKiPrice] = useState(499);

  const missedCalls = Math.round((callsPerMonth * missedPct) / 100);
  const lostDeals = (missedCalls * conversionPct) / 100;
  const lostRevenue = lostDeals * dealValue;
  const recovered = (lostRevenue * recoverPct) / 100;
  const netGain = recovered - kiPrice;
  const roiX = kiPrice > 0 ? recovered / kiPrice : 0;

  return (
    <Card className="border-sky/30 bg-gradient-to-br from-sky/[0.05] to-surface">
      <CardBody className="space-y-3">
        <button type="button" onClick={() => setOpen((o) => !o)} className="flex w-full items-center justify-between gap-3">
          <span className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-sky/10 text-sky-deep">
              <IconBolt size={15} />
            </span>
            <span className="text-left">
              <span className="block text-sm font-semibold text-ink">KI-ROI-Rechner (RSG AI)</span>
              <span className="block text-xs text-muted">Verpasste Anrufe in Umsatz übersetzen – Pitch-Argument in Sekunden</span>
            </span>
          </span>
          <IconChevronRight size={16} className={`flex-none text-faint transition-transform ${open ? "rotate-90" : ""}`} />
        </button>

        {open ? (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <NumField label="Anrufe / Monat" value={callsPerMonth} onChange={setCalls} />
              <NumField label="davon verpasst" value={missedPct} onChange={setMissed} suffix="%" />
              <NumField label="Conversion" value={conversionPct} onChange={setConversion} suffix="%" />
              <NumField label="Ø Auftragswert" value={dealValue} onChange={setDealValue} suffix="€" />
              <NumField label="KI fängt auf" value={recoverPct} onChange={setRecover} suffix="%" />
              <NumField label="KI-Preis / Monat" value={kiPrice} onChange={setKiPrice} suffix="€" />
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-xl border border-warning/30 bg-warning/[0.06] p-3">
                <p className="kpi-label">Entgangener Umsatz / Monat</p>
                <p className="mt-1 text-xl font-black text-warning">{formatEur(lostRevenue)}</p>
                <p className="text-[0.7rem] text-muted">{missedCalls} verpasste Anrufe · {lostDeals.toFixed(1)} Aufträge</p>
              </div>
              <div className="rounded-xl border border-success/30 bg-success/[0.06] p-3">
                <p className="kpi-label">Mit KI rückgewonnen</p>
                <p className="mt-1 text-xl font-black text-success">{formatEur(recovered)}</p>
                <p className="text-[0.7rem] text-muted">netto {formatEur(netGain)} nach KI-Kosten</p>
              </div>
              <div className="rounded-xl border border-brand/30 bg-brand/[0.06] p-3">
                <p className="kpi-label">ROI</p>
                <p className="mt-1 text-xl font-black text-brand-deep">{roiX.toFixed(1)}×</p>
                <p className="text-[0.7rem] text-muted">je 1 € KI-Invest</p>
              </div>
            </div>
            <p className="text-[0.7rem] text-faint">
              Beispielrechnung – Werte anpassen und dem Prospect live zeigen. Schon bei konservativen Annahmen
              amortisiert sich die KI-Telefonassistenz meist im ersten Monat.
            </p>
          </div>
        ) : null}
      </CardBody>
    </Card>
  );
}
