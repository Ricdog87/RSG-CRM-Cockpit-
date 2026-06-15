import { getCockpitData } from "@/lib/data";
import { PageHeader } from "@/components/cockpit/PageHeader";
import { StatCard } from "@/components/cockpit/StatCard";
import { OverrideNudge } from "@/components/cockpit/OverrideNudge";
import { Provisionsarten } from "@/components/cockpit/Provisionsarten";
import { Card, CardBody, SectionHeader } from "@/components/ui/Card";
import { BestandChart } from "@/components/cockpit/BestandChart";
import { IconEuro, IconCheck, IconAlert, IconNetwork } from "@/components/ui/icons";
import { formatEur } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function ProvisionenPage() {
  const { earnings, bestandsverlauf, provisionAktuellerMonat, override, career } =
    await getCockpitData();

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Vergütung"
        title="Provisionen"
        description="Gutschriftsverfahren · freigegebene Beträge werden zum 15. des Folgemonats ausgezahlt (§4)."
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          label="Diesen Monat"
          value={formatEur(provisionAktuellerMonat)}
          hint="laufender Abrechnungsmonat"
          accent="brand"
          icon={IconEuro}
        />
        <StatCard
          label="Offen freigegeben"
          value={formatEur(earnings.offen_freigegeben)}
          hint="zur Auszahlung am 15."
          accent="sky"
          icon={IconCheck}
        />
        <StatCard
          label="Stornoreserve"
          value={formatEur(earnings.in_stornoreserve)}
          hint="Freigabe nach 6 Monaten (§5)"
          accent="warning"
          icon={IconAlert}
        />
        <StatCard
          label="Override pausiert"
          value={formatEur(earnings.override_pausiert)}
          hint={
            earnings.override_pausiert > 0
              ? "Mindestaktivität nicht erfüllt"
              : "Override läuft"
          }
          accent={earnings.override_pausiert > 0 ? "warning" : "success"}
          icon={IconNetwork}
        />
      </div>

      <OverrideNudge earnings={earnings} override={override} />

      <Card>
        <CardBody>
          <SectionHeader
            title="Bestandsentwicklung"
            hint="Monatliche Bestandsprovision der letzten 12 Monate"
          />
          <BestandChart data={bestandsverlauf} />
        </CardBody>
      </Card>

      <Provisionsarten currentStufe={career.current.name} />
    </div>
  );
}
