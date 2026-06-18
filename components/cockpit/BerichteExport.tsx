"use client";

import { downloadCsv } from "@/lib/csv-export";

export interface ReportKpi {
  group: string;
  label: string;
  value: string;
}

export interface ReportSourceRow {
  source: string;
  candidates: number;
  placed: number;
  fee: number;
}

/**
 * Exportiert die Berichts-Kennzahlen als CSV (Excel-freundlich).
 * Zwei Dateien auf Wunsch: Kennzahlen-Übersicht und Quellen-ROI.
 */
export function BerichteExport({
  kpis,
  sources,
}: {
  kpis: ReportKpi[];
  sources: ReportSourceRow[];
}) {
  const stamp = new Date().toISOString().slice(0, 10);

  function exportKpis() {
    downloadCsv(`berichte-kennzahlen-${stamp}`, kpis, [
      { key: "group", label: "Bereich" },
      { key: "label", label: "Kennzahl" },
      { key: "value", label: "Wert" },
    ]);
  }

  function exportSources() {
    downloadCsv(`berichte-quellen-roi-${stamp}`, sources, [
      { key: "source", label: "Quelle" },
      { key: "candidates", label: "Kandidat:innen" },
      { key: "placed", label: "Platzierungen" },
      {
        key: "rate",
        label: "Quote %",
        get: (r) => (r.candidates > 0 ? Math.round((r.placed / r.candidates) * 100) : 0),
      },
      { key: "fee", label: "Honorar EUR" },
    ]);
  }

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={exportKpis}
        className="rounded-xl border border-border bg-surface px-3 py-2 text-sm font-medium text-ink hover:bg-elevated"
        title="Alle Kennzahlen als CSV exportieren"
      >
        Export Kennzahlen
      </button>
      {sources.length > 0 ? (
        <button
          type="button"
          onClick={exportSources}
          className="rounded-xl border border-border bg-surface px-3 py-2 text-sm font-medium text-ink hover:bg-elevated"
          title="Quellen-ROI als CSV exportieren"
        >
          Quellen-ROI
        </button>
      ) : null}
    </div>
  );
}
