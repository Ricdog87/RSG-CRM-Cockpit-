import { getMandates, getAccounts, getCandidates } from "@/lib/crm-data";
import { PageHeader } from "@/components/cockpit/PageHeader";
import { MandatesView } from "@/components/cockpit/views/MandatesView";
import { StatCard } from "@/components/cockpit/StatCard";
import { MandateFormDialog } from "@/components/cockpit/MandateFormDialog";
import { ActivityLogger } from "@/components/cockpit/ActivityLogger";
import { Card, CardBody, SectionHeader } from "@/components/ui/Card";
import { mandateRevenue } from "@/lib/crm-types";
import { IconBriefcase, IconUserCheck, IconEuro, IconTrendingUp } from "@/components/ui/icons";
import { formatEur, formatNumber } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function RecruitingProjektePage() {
  const [mandates, accounts, candidates] = await Promise.all([
    getMandates(),
    getAccounts(),
    getCandidates(),
  ]);
  const accountNames = accounts.map((a) => a.name);

  // „Angebot / Planung" zählt als Forecast, nicht als gewonnenes Mandat.
  const aktiv = mandates.filter((m) => m.status !== "angebot");
  const angebote = mandates.filter((m) => m.status === "angebot");

  const offenePositionen = aktiv.reduce(
    (s, m) => s + Math.max(0, m.positions - m.filled),
    0
  );
  const besetzt = aktiv.reduce((s, m) => s + m.filled, 0);
  // Offenes Volumen: erwarteter Umsatz je offener Stelle (gewonnene Mandate).
  const openVolume = aktiv.reduce((s, m) => {
    const offen = Math.max(0, m.positions - m.filled);
    const perPos = m.positions > 0 ? mandateRevenue(m) / m.positions : 0;
    return s + offen * perPos;
  }, 0);
  // Forecast: erwarteter Umsatz der Angebots-/Planungs-Mandate.
  const forecast = angebote.reduce((s, m) => s + mandateRevenue(m), 0);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Projekte · RSG Recruiting"
        title="Personalvermittlung"
        description="Recruiting-Mandate, Besetzungsfortschritt und offenes Festpreis-Volumen."
        action={<MandateFormDialog accountNames={accountNames} />}
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <StatCard
          label="Aktive Mandate"
          value={formatNumber(aktiv.length)}
          hint={`${formatNumber(offenePositionen)} offene Stellen`}
          accent="brand"
          icon={IconBriefcase}
        />
        <StatCard
          label="Forecast (Angebot)"
          value={formatEur(forecast)}
          hint={`${formatNumber(angebote.length)} in Planung`}
          accent="sky"
          icon={IconTrendingUp}
        />
        <StatCard
          label="Besetzt"
          value={formatNumber(besetzt)}
          hint="erfolgreich vermittelt"
          accent="success"
          icon={IconUserCheck}
        />
        <StatCard
          label="Offenes Volumen"
          value={formatEur(openVolume)}
          hint="Festpreis noch zu besetzen"
          accent="warning"
          icon={IconEuro}
        />
        <StatCard
          label="Mandate gesamt"
          value={formatNumber(mandates.length)}
          hint={`${formatNumber(angebote.length)} Angebot · ${formatNumber(aktiv.length)} gewonnen`}
          accent="neutral"
          icon={IconBriefcase}
        />
      </div>

      <Card>
        <CardBody>
          <SectionHeader title="Recruiting-Aktivität erfassen" hint="Call/E-Mail → Korrespondenz beim Kunden + Wiedervorlage" />
          <ActivityLogger accounts={accountNames} lineLock="recruiting" />
        </CardBody>
      </Card>

      <MandatesView
        mandates={mandates}
        accountNames={accountNames}
        candidates={candidates}
      />
    </div>
  );
}
