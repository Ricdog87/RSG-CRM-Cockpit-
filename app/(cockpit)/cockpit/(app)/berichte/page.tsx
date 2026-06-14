import { getOpportunities, getMandates } from "@/lib/crm-data";
import { PageHeader } from "@/components/cockpit/PageHeader";
import { StatCard } from "@/components/cockpit/StatCard";
import { Card, CardBody, SectionHeader } from "@/components/ui/Card";
import { FunnelChart, ForecastChart } from "@/components/cockpit/BerichteCharts";
import { IconTarget, IconEuro, IconTrendingUp, IconBriefcase } from "@/components/ui/icons";
import { formatEur, formatPercent } from "@/lib/format";

export const dynamic = "force-dynamic";

const STAGES: { key: string; label: string }[] = [
  { key: "neu", label: "Neu" },
  { key: "qualifiziert", label: "Qualifiziert" },
  { key: "demo", label: "Demo/Termin" },
  { key: "angebot", label: "Angebot" },
  { key: "verhandlung", label: "Verhandlung" },
  { key: "gewonnen", label: "Gewonnen" },
];

const MONTHS = ["Jan", "Feb", "Mär", "Apr", "Mai", "Jun", "Jul", "Aug", "Sep", "Okt", "Nov", "Dez"];

export default async function BerichtePage() {
  const [opps, mandates] = await Promise.all([getOpportunities(), getMandates()]);

  const open = opps.filter((o) => o.stage !== "gewonnen" && o.stage !== "verloren");
  const won = opps.filter((o) => o.stage === "gewonnen").length;
  const lost = opps.filter((o) => o.stage === "verloren").length;
  const weighted = open.reduce((s, o) => s + (o.value * o.probability) / 100, 0);
  const avgDeal = open.length ? open.reduce((s, o) => s + o.value, 0) / open.length : 0;
  const winRate = won + lost > 0 ? (won / (won + lost)) * 100 : 0;

  // Funnel: Anzahl je Phase.
  const funnel = STAGES.map(({ key, label }) => ({
    stage: label,
    count: opps.filter((o) => o.stage === key).length,
  }));

  // Forecast: gewichtetes Volumen je erwartetem Abschlussmonat.
  const byMonth = new Map<string, number>();
  for (const o of open) {
    if (!o.expected_close) continue;
    const d = new Date(o.expected_close);
    if (Number.isNaN(d.getTime())) continue;
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    byMonth.set(key, (byMonth.get(key) ?? 0) + (o.value * o.probability) / 100);
  }
  const forecast = Array.from(byMonth.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .slice(0, 8)
    .map(([key, value]) => ({
      month: MONTHS[Number(key.slice(5, 7)) - 1],
      value: Math.round(value),
    }));

  const openPositions = mandates.reduce((s, m) => s + Math.max(0, m.positions - m.filled), 0);
  const filled = mandates.reduce((s, m) => s + m.filled, 0);
  const totalPositions = mandates.reduce((s, m) => s + m.positions, 0);
  const fillRate = totalPositions > 0 ? (filled / totalPositions) * 100 : 0;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Analytics"
        title="Berichte"
        description="Pipeline-Funnel, Forecast und Vertriebskennzahlen auf einen Blick."
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          label="Offene Chancen"
          value={`${open.length}`}
          hint={`${formatEur(weighted)} gewichtet`}
          accent="sky"
          icon={IconTarget}
        />
        <StatCard
          label="Ø Dealgröße"
          value={formatEur(avgDeal)}
          hint="offene Chancen"
          accent="brand"
          icon={IconEuro}
        />
        <StatCard
          label="Win-Rate"
          value={formatPercent(winRate)}
          hint={`${won} gewonnen · ${lost} verloren`}
          accent="success"
          icon={IconTrendingUp}
        />
        <StatCard
          label="Besetzungsquote"
          value={formatPercent(fillRate)}
          hint={`${openPositions} Stellen offen`}
          accent="warning"
          icon={IconBriefcase}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardBody>
            <SectionHeader title="Pipeline-Funnel" hint="Anzahl Chancen je Phase" />
            <FunnelChart data={funnel} />
          </CardBody>
        </Card>
        <Card>
          <CardBody>
            <SectionHeader
              title="Forecast"
              hint="gewichtetes Volumen je erwartetem Abschluss"
            />
            {forecast.length > 0 ? (
              <ForecastChart data={forecast} />
            ) : (
              <p className="py-12 text-center text-sm text-faint">
                Noch keine datierten Abschlüsse für einen Forecast.
              </p>
            )}
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
