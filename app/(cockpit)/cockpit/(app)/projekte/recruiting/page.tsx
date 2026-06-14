import { getMandates } from "@/lib/crm-data";
import { createMandate } from "@/lib/crm-actions";
import { PageHeader } from "@/components/cockpit/PageHeader";
import { MandatesView } from "@/components/cockpit/views/MandatesView";
import { StatCard } from "@/components/cockpit/StatCard";
import { EntityFormDialog } from "@/components/cockpit/EntityFormDialog";
import { MANDATE_FIELDS } from "@/lib/crm-forms";
import { IconBriefcase, IconUserCheck, IconEuro } from "@/components/ui/icons";
import { formatEur, formatNumber } from "@/lib/format";

export const dynamic = "force-dynamic";

// Anlegen ohne „davon besetzt" (Feld nur beim Bearbeiten relevant).
const CREATE_FIELDS = MANDATE_FIELDS.filter((f) => f.name !== "filled");

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
          <EntityFormDialog
            triggerLabel="Mandat anlegen"
            title="Neues Recruiting-Mandat"
            description="Offene Stelle mit Festpreis und Deadline erfassen."
            fields={CREATE_FIELDS}
            action={createMandate}
          />
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          label="Aktive Mandate"
          value={formatNumber(mandates.length)}
          hint={`${formatNumber(offenePositionen)} offene Stellen`}
          accent="brand"
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
          accent="sky"
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

      <MandatesView mandates={mandates} />
    </div>
  );
}
