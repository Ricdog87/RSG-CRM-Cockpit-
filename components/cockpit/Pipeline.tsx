import { Card, CardBody, SectionHeader } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { formatDate, formatEur, formatPercent } from "@/lib/format";
import type { Deal, DealStage } from "@/lib/types";

const stageMeta: Record<
  DealStage,
  { label: string; tone: "neutral" | "cyan" | "purple" | "success" | "danger" }
> = {
  neu: { label: "Neu", tone: "neutral" },
  qualifiziert: { label: "Qualifiziert", tone: "cyan" },
  angebot: { label: "Angebot", tone: "cyan" },
  verhandlung: { label: "Verhandlung", tone: "purple" },
  gewonnen: { label: "Gewonnen", tone: "success" },
  verloren: { label: "Verloren", tone: "danger" },
};

/** Pipeline aus deals (join customers, products). */
export function Pipeline({ deals }: { deals: Deal[] }) {
  const open = deals.filter(
    (d) => d.stage !== "gewonnen" && d.stage !== "verloren"
  );
  const weightedMrr = open.reduce(
    (sum, d) => sum + (d.mrr_value * d.probability) / 100,
    0
  );

  return (
    <Card>
      <CardBody>
        <SectionHeader
          title="Pipeline"
          hint={
            open.length > 0
              ? `${open.length} offene Deals · ${formatEur(weightedMrr)} gewichtetes MRR-Potenzial`
              : undefined
          }
        />

        {deals.length === 0 ? (
          <EmptyState
            title="Noch keine Deals in deiner Pipeline. Leg deinen ersten Abschluss an, um ihn hier zu verfolgen."
            action={<Button variant="ghost">Deal anlegen</Button>}
          />
        ) : (
          <ul className="divide-y divide-border">
            {deals.map((deal) => {
              const meta = stageMeta[deal.stage];
              return (
                <li
                  key={deal.id}
                  className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-ink">
                      {deal.customer_name}
                    </p>
                    <p className="truncate text-xs text-muted">
                      {deal.product_name} · {formatDate(deal.expected_close)}
                    </p>
                  </div>
                  <div className="flex flex-none items-center gap-3">
                    <div className="hidden text-right sm:block">
                      <p className="text-sm font-semibold text-ink">
                        {formatEur(deal.mrr_value)}/M
                      </p>
                      <p className="text-xs text-faint">
                        {formatPercent(deal.probability)}
                      </p>
                    </div>
                    <Badge tone={meta.tone}>{meta.label}</Badge>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </CardBody>
    </Card>
  );
}
