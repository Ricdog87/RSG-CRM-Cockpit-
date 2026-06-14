import { Card, CardBody } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { stageMeta } from "@/components/cockpit/Pipeline";
import { formatDate, formatEur, formatPercent } from "@/lib/format";
import type { Deal, DealStage } from "@/lib/types";

// Spaltenreihenfolge des Boards (offene Phasen + Abschlüsse).
const COLUMNS: DealStage[] = [
  "neu",
  "qualifiziert",
  "angebot",
  "verhandlung",
  "gewonnen",
];

function DealCard({ deal }: { deal: Deal }) {
  return (
    <div className="rounded-xl border border-border bg-elevated/50 p-3 transition-colors hover:border-brand/40">
      <p className="truncate text-sm font-medium text-ink">{deal.customer_name}</p>
      <p className="mt-0.5 truncate text-xs text-muted">{deal.product_name}</p>
      <div className="mt-3 flex items-center justify-between">
        <span className="text-sm font-semibold text-ink">
          {formatEur(deal.mrr_value)}/M
        </span>
        <span className="text-xs text-faint">{formatPercent(deal.probability)}</span>
      </div>
      <p className="mt-1 text-[0.7rem] text-faint">
        Abschluss: {formatDate(deal.expected_close)}
      </p>
    </div>
  );
}

/** Kanban-Board: Deals nach Phase gruppiert. */
export function PipelineBoard({ deals }: { deals: Deal[] }) {
  if (deals.length === 0) {
    return (
      <Card>
        <CardBody>
          <EmptyState title="Noch keine Deals. Lege deinen ersten Abschluss an, um deine Pipeline aufzubauen." />
        </CardBody>
      </Card>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5">
      {COLUMNS.map((stage) => {
        const items = deals.filter((d) => d.stage === stage);
        const meta = stageMeta[stage];
        const sum = items.reduce((s, d) => s + d.mrr_value, 0);
        return (
          <div
            key={stage}
            className="flex flex-col gap-3 rounded-2xl border border-border/60 bg-surface/40 p-3"
          >
            <div className="flex items-center justify-between">
              <Badge tone={meta.tone}>{meta.label}</Badge>
              <span className="text-xs text-faint">{items.length}</span>
            </div>
            <div className="space-y-2">
              {items.length === 0 ? (
                <p className="px-1 py-4 text-center text-xs text-faint">—</p>
              ) : (
                items.map((deal) => <DealCard key={deal.id} deal={deal} />)
              )}
            </div>
            {items.length > 0 ? (
              <p className="mt-auto border-t border-border/60 pt-2 text-xs text-muted">
                {formatEur(sum)}/M
              </p>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
