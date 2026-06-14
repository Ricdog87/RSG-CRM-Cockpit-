import { StatCard } from "@/components/cockpit/StatCard";
import { formatEur, formatNumber } from "@/lib/format";
import { IconUsers, IconEuro, IconAlert, IconNetwork } from "@/components/ui/icons";
import type { PartnerBestand, PartnerEarnings } from "@/lib/types";

/** KPI-Reihe: aktive Kunden, Provision diesen Monat, Stornoreserve, Override-Status. */
export function KpiRow({
  bestand,
  earnings,
  provisionAktuellerMonat,
}: {
  bestand: PartnerBestand;
  earnings: PartnerEarnings;
  provisionAktuellerMonat: number;
}) {
  const overridePaused = earnings.override_pausiert > 0;

  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <StatCard
        label="Aktive Kund:innen"
        value={formatNumber(bestand.aktive_kunden)}
        hint="zahlen aktuell deinen Bestand"
        accent="cyan"
        icon={IconUsers}
      />
      <StatCard
        label="Provision diesen Monat"
        value={formatEur(provisionAktuellerMonat)}
        hint={`${formatEur(earnings.offen_freigegeben)} freigegeben · Auszahlung zum 15.`}
        accent="purple"
        icon={IconEuro}
      />
      <StatCard
        label="Stornoreserve"
        value={formatEur(earnings.in_stornoreserve)}
        hint="Freigabe nach 6 Monaten Laufzeit"
        accent="warning"
        icon={IconAlert}
      />
      <StatCard
        label="Override-Status"
        value={overridePaused ? "Pausiert" : "Aktiv"}
        hint={
          overridePaused
            ? `${formatEur(earnings.override_pausiert)} zurückgestellt`
            : "läuft auf deine Downline"
        }
        accent={overridePaused ? "warning" : "success"}
        icon={IconNetwork}
      />
    </div>
  );
}
