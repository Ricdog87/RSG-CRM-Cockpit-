import { Card, CardBody } from "@/components/ui/Card";
import { cn } from "@/components/ui/cn";

/**
 * Geteilte Tabellen-Primitive für die Listenansichten (Konten, KI-Projekte …).
 * Sorgt für identische Kopf-/Zeilen-Paddings, Hover und Spaltenraster (12er-Grid)
 * über alle Listen hinweg – HubSpot-Stil.
 */

// Statische Spannweiten-Klassen (Tailwind erkennt keine dynamischen `col-span-${n}`).
const SPAN: Record<number, string> = {
  1: "col-span-1",
  2: "col-span-2",
  3: "col-span-3",
  4: "col-span-4",
  5: "col-span-5",
  6: "col-span-6",
  7: "col-span-7",
  8: "col-span-8",
  9: "col-span-9",
  10: "col-span-10",
  11: "col-span-11",
  12: "col-span-12",
};

export interface TableColumn {
  label: React.ReactNode;
  span: number;
  align?: "right";
  /** Optional: Sortier-Schlüssel – macht den Kopf klickbar. */
  sortKey?: string;
}

/** Karten-Hülle für eine Tabelle (randlos, damit Zeilen bündig sitzen). */
export function TableCard({ children }: { children: React.ReactNode }) {
  return (
    <Card>
      <CardBody className="p-0 sm:p-0">{children}</CardBody>
    </Card>
  );
}

/** Spaltenkopf (nur ab `lg` sichtbar – mobil rendern die Zeilen ihre eigene Karte). */
export function TableHead({
  columns,
  sort,
  sortDir,
  onSort,
}: {
  columns: TableColumn[];
  /** Aktueller Sortier-Schlüssel (für die Pfeil-Anzeige). */
  sort?: string;
  /** Richtung des aktiven Sort-Schlüssels (für ↑/↓). */
  sortDir?: "asc" | "desc";
  /** Callback beim Klick auf einen sortierbaren Kopf. */
  onSort?: (key: string) => void;
}) {
  return (
    <div className="hidden grid-cols-12 gap-3 border-b border-border px-5 py-3 text-xs font-medium uppercase tracking-wider text-faint lg:grid">
      {columns.map((c, i) => {
        const sortable = Boolean(c.sortKey && onSort);
        const active = Boolean(c.sortKey && sort === c.sortKey);
        return (
          <span
            key={i}
            className={cn(SPAN[c.span], c.align === "right" && "text-right")}
          >
            {sortable ? (
              <button
                type="button"
                onClick={() => onSort!(c.sortKey!)}
                aria-label={`Nach ${typeof c.label === "string" ? c.label : "Spalte"} sortieren`}
                className={cn(
                  "inline-flex items-center gap-1 uppercase tracking-wider transition-colors hover:text-ink",
                  c.align === "right" && "flex-row-reverse",
                  active && "text-ink"
                )}
              >
                {c.label}
                <span className={cn("text-[0.6rem]", active ? "text-brand-deep" : "text-faint/60")}>
                  {active ? (sortDir === "asc" ? "↑" : "↓") : "↕"}
                </span>
              </button>
            ) : (
              c.label
            )}
          </span>
        );
      })}
    </div>
  );
}

/** Zeilen-Container (`<ul>` mit Trennlinien). */
export function TableBody({ children }: { children: React.ReactNode }) {
  return <ul className="divide-y divide-border">{children}</ul>;
}

/** Einzelne Tabellenzeile – einheitliches Padding + Hover, 12er-Grid ab `lg`. */
export function TableRow({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <li
      className={cn(
        "px-4 py-3.5 transition-colors hover:bg-elevated/40 lg:grid lg:grid-cols-12 lg:items-center lg:gap-3 lg:px-5",
        className
      )}
    >
      {children}
    </li>
  );
}
