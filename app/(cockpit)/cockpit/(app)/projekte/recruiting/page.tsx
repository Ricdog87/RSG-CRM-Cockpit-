import { getMandates } from "@/lib/crm-data";
import { PageHeader } from "@/components/cockpit/PageHeader";
import { MandatesList } from "@/components/cockpit/MandatesList";
import { StatCard } from "@/components/cockpit/StatCard";
import { Button } from "@/components/ui/Button";
import { IconBriefcase, IconUserCheck, IconEuro, IconPlus } from "@/components/ui/icons";
import { formatEur, formatNumber } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function RecruitingProjektePage() {
  const mandates = await getMandates();

  const offenePositionen = mandates.reduce(
    (s, m) => s + Math.max(0, m.positions - m.filled),
    0
  );
  const besetzt = mandates.reduce((s, m) => s + m.filled, 0);
  const kandidaten = mandates.reduce((s, m) => s + m.candidate_count, 0);
  const openVolume = mandates.reduce(
    (s, m) => s + Math.max(0, m.positions - m.filled) * m.fee,
    0
  );

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Projekte · RSG Recruiting"
        title="Personalvermittlung"
        description="Recruiting-Mandate, Besetzungsfortschritt und offenes Festpreis-Volumen."
        action={
          <Button>
            <IconPlus size={16} /> Mandat anlegen
          </Button>
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          label="Aktive Mandate"
          value={formatNumber(mandates.length)}
          hint={`${formatNumber(offenePositionen)} offene Stellen`}
          accent="purple"
          icon={IconBriefcase}
        />
        <StatCard
          label="Besetzt"
          value={formatNumber(besetzt)}
          hint="erfolgreich vermittelt"
          accent="success"
          icon={IconUserCheck}
        />
        <StatCard
          label="Kandidat:innen"
          value={formatNumber(kandidaten)}
          hint="in der Pipeline"
          accent="cyan"
          icon={IconUserCheck}
        />
        <StatCard
          label="Offenes Volumen"
          value={formatEur(openVolume)}
          hint="Festpreis noch zu besetzen"
          accent="warning"
          icon={IconEuro}
        />
      </div>

      <MandatesList mandates={mandates} />
    </div>
  );
}
