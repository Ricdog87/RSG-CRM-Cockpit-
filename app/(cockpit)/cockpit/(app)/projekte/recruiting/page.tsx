import { getMandates, getAccounts } from "@/lib/crm-data";
import { PageHeader } from "@/components/cockpit/PageHeader";
import { MandatesView } from "@/components/cockpit/views/MandatesView";
import { StatCard } from "@/components/cockpit/StatCard";
import { MandateFormDialog } from "@/components/cockpit/MandateFormDialog";
import { mandateRevenue } from "@/lib/crm-types";
import { IconBriefcase, IconUserCheck, IconEuro } from "@/components/ui/icons";
import { formatEur, formatNumber } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function RecruitingProjektePage() {
  const [mandates, accounts] = await Promise.all([getMandates(), getAccounts()]);
  const accountNames = accounts.map((a) => a.name);

  const offenePositionen = mandates.reduce(
    (s, m) => s + Math.max(0, m.positions - m.filled),
    0
  );
  const besetzt = mandates.reduce((s, m) => s + m.filled, 0);
  const kandidaten = mandates.reduce((s, m) => s + m.candidate_count, 0);
  // Offenes Volumen: erwarteter Umsatz je offener Stelle (Festpreis ODER %).
  const openVolume = mandates.reduce((s, m) => {
    const offen = Math.max(0, m.positions - m.filled);
    const perPos = m.positions > 0 ? mandateRevenue(m) / m.positions : 0;
    return s + offen * perPos;
  }, 0);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Projekte · RSG Recruiting"
        title="Personalvermittlung"
        description="Recruiting-Mandate, Besetzungsfortschritt und offenes Festpreis-Volumen."
        action={<MandateFormDialog accountNames={accountNames} />}
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

      <MandatesView mandates={mandates} accountNames={accountNames} />
    </div>
  );
}
