import { Card, CardBody } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { BestandChart } from "@/components/cockpit/BestandChart";
import { formatDelta, formatEur, formatNumber } from "@/lib/format";
import type { BestandPoint, PartnerBestand } from "@/lib/types";

/**
 * Held des Screens: der wachsende wiederkehrende Bestand.
 * Große Zahl (€/Monat) + Wachstums-Area-Chart.
 */
export function HeroBestand({
  bestand,
  verlauf,
}: {
  bestand: PartnerBestand;
  verlauf: BestandPoint[];
}) {
  const last = verlauf.at(-1)?.amount ?? bestand.monatl_bestandsprovision;
  const prev = verlauf.at(-2)?.amount ?? last;
  const first = verlauf.find((p) => p.amount > 0)?.amount ?? last;

  const momDelta = prev > 0 ? ((last - prev) / prev) * 100 : 0;
  const yoyDelta = first > 0 ? ((last - first) / first) * 100 : 0;

  return (
    <Card className="overflow-hidden">
      <CardBody className="space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="kpi-label">Wiederkehrender Bestand</p>
            <div className="mt-2 flex items-end gap-2">
              <span className="bg-gradient-to-r from-purple-soft to-cyan-soft bg-clip-text text-4xl font-black tracking-tight text-transparent sm:text-5xl">
                {formatEur(bestand.monatl_bestandsprovision)}
              </span>
              <span className="mb-1 text-sm text-muted">/ Monat</span>
            </div>
            <p className="mt-2 text-sm text-muted">
              aus {formatNumber(bestand.aktive_kunden)} aktiven Kund:innen ·{" "}
              {formatEur(bestand.mrr_bestand)} MRR-Volumen
            </p>
          </div>
          <div className="flex flex-col items-end gap-2">
            {momDelta !== 0 ? (
              <Badge tone={momDelta >= 0 ? "success" : "danger"}>
                {formatDelta(momDelta)} ggü. Vormonat
              </Badge>
            ) : null}
            {yoyDelta > 0 ? (
              <Badge tone="purple">{formatDelta(yoyDelta)} über 12 Monate</Badge>
            ) : null}
          </div>
        </div>

        <BestandChart data={verlauf} />
      </CardBody>
    </Card>
  );
}
