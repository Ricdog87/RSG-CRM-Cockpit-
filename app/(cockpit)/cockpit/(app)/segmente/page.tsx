import { getSegments } from "@/lib/crm-data";
import { PageHeader } from "@/components/cockpit/PageHeader";
import { StatCard } from "@/components/cockpit/StatCard";
import { Card, CardBody } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { IconLayers, IconUsers, IconEuro, IconPlus } from "@/components/ui/icons";
import { formatEur, formatNumber } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function SegmentePage() {
  const segments = await getSegments();
  const totalAccounts = segments.reduce((s, x) => s + x.accounts, 0);
  const totalMrr = segments.reduce((s, x) => s + x.mrr, 0);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Vertrieb"
        title="Segmente"
        description="KI-Zielgruppen nach Branche und Use-Case – Basis für gezielte Ansprache."
        action={
          <Button>
            <IconPlus size={16} /> Segment anlegen
          </Button>
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        <StatCard
          label="Segmente"
          value={formatNumber(segments.length)}
          hint="aktive Zielgruppen"
          accent="cyan"
          icon={IconLayers}
        />
        <StatCard
          label="Accounts gesamt"
          value={formatNumber(totalAccounts)}
          hint="über alle Segmente"
          accent="purple"
          icon={IconUsers}
        />
        <StatCard
          label="MRR gesamt"
          value={`${formatEur(totalMrr)}/M`}
          hint="wiederkehrender Umsatz"
          accent="success"
          icon={IconEuro}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {segments.map((s) => (
          <Card key={s.id} className="card-hover">
            <CardBody className="space-y-3">
              <div className="flex items-start justify-between gap-2">
                <h3 className="text-base font-semibold text-ink">{s.name}</h3>
                <Badge tone="cyan">{formatNumber(s.accounts)} Accounts</Badge>
              </div>
              <p className="text-sm text-muted">{s.description}</p>
              <div className="flex items-center justify-between border-t border-border/60 pt-3 text-sm">
                <span className="text-faint">
                  Top: <span className="text-muted">{s.top_product}</span>
                </span>
                <span className="font-semibold text-ink">{formatEur(s.mrr)}/M</span>
              </div>
            </CardBody>
          </Card>
        ))}
      </div>
    </div>
  );
}
