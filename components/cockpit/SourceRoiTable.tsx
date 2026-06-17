import { EmptyState } from "@/components/ui/EmptyState";
import { formatEur, formatPercent } from "@/lib/format";

export interface SourceRoiRow {
  source: string;
  candidates: number;
  placed: number;
  fee: number;
}

/** Quellen-ROI: welche Recruiting-Kanäle liefern Platzierungen & Honorar. */
export function SourceRoiTable({ rows }: { rows: SourceRoiRow[] }) {
  if (rows.length === 0) {
    return <EmptyState title="Noch keine Quellendaten – Quelle bei Kandidat:innen pflegen." />;
  }
  return (
    <div className="overflow-hidden rounded-xl border border-border">
      <div className="grid grid-cols-12 gap-2 border-b border-border bg-elevated/40 px-3 py-2 text-[0.65rem] font-semibold uppercase tracking-wider text-faint">
        <span className="col-span-4">Quelle</span>
        <span className="col-span-2 text-right">Kand.</span>
        <span className="col-span-2 text-right">Platz.</span>
        <span className="col-span-2 text-right">Quote</span>
        <span className="col-span-2 text-right">Honorar</span>
      </div>
      <ul className="divide-y divide-border">
        {rows.map((r) => {
          const rate = r.candidates > 0 ? (r.placed / r.candidates) * 100 : 0;
          return (
            <li key={r.source} className="grid grid-cols-12 items-center gap-2 px-3 py-2.5 text-sm">
              <span className="col-span-4 truncate font-medium text-ink">{r.source || "Unbekannt"}</span>
              <span className="col-span-2 text-right tabular-nums text-muted">{r.candidates}</span>
              <span className="col-span-2 text-right tabular-nums font-semibold text-ink">{r.placed}</span>
              <span className="col-span-2 text-right tabular-nums text-muted">{formatPercent(rate)}</span>
              <span className="col-span-2 text-right tabular-nums font-medium text-success">{formatEur(r.fee)}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
