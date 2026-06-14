import Link from "next/link";
import { Card, CardBody, SectionHeader } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { IconChevronRight } from "@/components/ui/icons";
import { formatDate, formatEur, formatPercent } from "@/lib/format";
import type { Deal, DealStage } from "@/lib/types";

export const stageMeta: Record<
  DealStage,
  { label: string; tone: "neutral" | "sky" | "brand" | "success" | "danger" }
> = {
  neu: { label: "Neu", tone: "neutral" },
  qualifiziert: { label: "Qualifiziert", tone: "sky" },
  angebot: { label: "Angebot", tone: "sky" },
  verhandlung: { label: "Verhandlung", tone: "brand" },
  gewonnen: { label: "Gewonnen", tone: "success" },
  verloren: { label: "Verloren", tone: "danger" },
};

/** Einzelne Deal-Zeile (wiederverwendet auf Dashboard + Pipeline-Seite). */
export function DealRow({ deal }: { deal: Deal }) {
  const meta = stageMeta[deal.stage];
  return (
    <li className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
      <div className="min-w-0">
        <p className="truncate text-sm font-medium text-ink">{deal.customer_name}</p>
        <p className="truncate text-xs text-muted">
          {deal.product_name} · {formatDate(deal.expected_close)}
        </p>
      </div>
      <div className="flex flex-none items-center gap-3">
        <div className="hidden text-right sm:block">
          <p className="text-sm font-semibold text-ink">
            {formatEur(deal.mrr_value)}/M
          </p>
          <p className="text-xs text-faint">{formatPercent(deal.probability)}</p>
        </div>
        <Badge tone={meta.tone}>{meta.label}</Badge>
      </div>
    </li>
  );
}

/** Pipeline-Vorschau (Dashboard) aus deals (join customers, products). */
export function Pipeline({
  deals,
  limit,
  viewAllHref,
}: {
  deals: Deal[];
  limit?: number;
  viewAllHref?: string;
}) {
  const open = deals.filter(
    (d) => d.stage !== "gewonnen" && d.stage !== "verloren"
  );
  const weightedMrr = open.reduce(
    (sum, d) => sum + (d.mrr_value * d.probability) / 100,
    0
  );
  const shown = limit ? open.slice(0, limit) : deals;

  return (
    <Card>
      <CardBody>
        <SectionHeader
          title="Pipeline"
          hint={
            open.length > 0
              ? `${open.length} offene Deals · ${formatEur(weightedMrr)} gewichtet`
              : undefined
          }
          action={
            viewAllHref ? (
              <Link
                href={viewAllHref}
                className="inline-flex items-center gap-1 text-xs font-semibold text-sky-deep hover:text-sky-ink"
              >
                Alle ansehen <IconChevronRight size={14} />
              </Link>
            ) : undefined
          }
        />

        {shown.length === 0 ? (
          <EmptyState
            title="Noch keine offenen Deals. Leg deinen ersten Abschluss an, um ihn hier zu verfolgen."
            action={<Button variant="ghost">Deal anlegen</Button>}
          />
        ) : (
          <ul className="divide-y divide-border">
            {shown.map((deal) => (
              <DealRow key={deal.id} deal={deal} />
            ))}
          </ul>
        )}
      </CardBody>
    </Card>
  );
}
