import { Card, CardBody } from "@/components/ui/Card";
import { formatEur, formatNumber } from "@/lib/format";
import type { PartnerBestand, PartnerEarnings } from "@/lib/types";

function Kpi({
  label,
  value,
  hint,
  accent,
}: {
  label: string;
  value: string;
  hint: string;
  accent: "purple" | "cyan" | "warning" | "neutral";
}) {
  const dot = {
    purple: "bg-purple",
    cyan: "bg-cyan",
    warning: "bg-warning",
    neutral: "bg-faint",
  }[accent];

  return (
    <Card>
      <CardBody className="space-y-2">
        <div className="flex items-center gap-2">
          <span className={`h-1.5 w-1.5 rounded-full ${dot}`} />
          <p className="kpi-label">{label}</p>
        </div>
        <p className="text-2xl font-bold text-ink">{value}</p>
        <p className="text-xs text-muted">{hint}</p>
      </CardBody>
    </Card>
  );
}

/** KPI-Reihe: aktive Kunden, Provision diesen Monat, Stornoreserve, Override-Status. */
export function KpiRow({
  bestand,
  earnings,
}: {
  bestand: PartnerBestand;
  earnings: PartnerEarnings;
}) {
  const overridePaused = earnings.override_pausiert > 0;

  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <Kpi
        label="Aktive Kund:innen"
        value={formatNumber(bestand.aktive_kunden)}
        hint="zahlen aktuell deinen Bestand"
        accent="cyan"
      />
      <Kpi
        label="Provision diesen Monat"
        value={formatEur(bestand.monatl_bestandsprovision)}
        hint={`${formatEur(earnings.offen_freigegeben)} offen freigegeben`}
        accent="purple"
      />
      <Kpi
        label="Stornoreserve"
        value={formatEur(earnings.in_stornoreserve)}
        hint="wird nach Stornofrist ausgezahlt"
        accent="warning"
      />
      <Kpi
        label="Override-Status"
        value={overridePaused ? "Pausiert" : "Aktiv"}
        hint={
          overridePaused
            ? `${formatEur(earnings.override_pausiert)} zurückgestellt`
            : "läuft auf deine Downline"
        }
        accent={overridePaused ? "warning" : "neutral"}
      />
    </div>
  );
}
