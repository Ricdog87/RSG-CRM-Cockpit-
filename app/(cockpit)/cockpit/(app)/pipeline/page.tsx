import { getCockpitData } from "@/lib/data";
import { PageHeader } from "@/components/cockpit/PageHeader";
import { PipelineBoard } from "@/components/cockpit/PipelineBoard";
import { StatCard } from "@/components/cockpit/StatCard";
import { Button } from "@/components/ui/Button";
import { IconPlus, IconPipeline, IconEuro, IconTrendingUp } from "@/components/ui/icons";
import { formatEur, formatNumber } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function PipelinePage() {
  const { pipeline } = await getCockpitData();

  const open = pipeline.filter(
    (d) => d.stage !== "gewonnen" && d.stage !== "verloren"
  );
  const openMrr = open.reduce((s, d) => s + d.mrr_value, 0);
  const weighted = open.reduce((s, d) => s + (d.mrr_value * d.probability) / 100, 0);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Deine Abschlüsse"
        title="Meine Pipeline"
        description="Deine persönlichen Deals nach Phase – mit gewichtetem MRR-Potenzial."
        action={
          <Button>
            <IconPlus size={16} /> Deal anlegen
          </Button>
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        <StatCard
          label="Offene Deals"
          value={formatNumber(open.length)}
          hint="in aktiver Bearbeitung"
          accent="sky"
          icon={IconPipeline}
        />
        <StatCard
          label="MRR-Volumen offen"
          value={`${formatEur(openMrr)}/M`}
          hint="Summe ungewichtet"
          accent="brand"
          icon={IconEuro}
        />
        <StatCard
          label="Gewichtetes Potenzial"
          value={`${formatEur(weighted)}/M`}
          hint="nach Abschluss-Wahrscheinlichkeit"
          accent="success"
          icon={IconTrendingUp}
        />
      </div>

      <PipelineBoard deals={pipeline} />
    </div>
  );
}
