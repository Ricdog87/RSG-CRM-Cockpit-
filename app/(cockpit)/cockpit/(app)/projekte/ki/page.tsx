import { getKiProjects } from "@/lib/crm-data";
import { PageHeader } from "@/components/cockpit/PageHeader";
import { KiProjectsView } from "@/components/cockpit/views/KiProjectsView";
import { StatCard } from "@/components/cockpit/StatCard";
import { IconPhone, IconSpark, IconEuro, IconAlert } from "@/components/ui/icons";
import { formatEur, formatNumber } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function KiProjektePage() {
  const projects = await getKiProjects();

  const live = projects.filter((p) => p.status === "live");
  const onboarding = projects.filter((p) => p.status === "onboarding");
  const risiko = projects.filter((p) => p.health === "risiko");
  const mrr = projects
    .filter((p) => p.status !== "gekuendigt")
    .reduce((s, p) => s + p.mrr, 0);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Projekte · RSG AI"
        title="KI & Telefonassistenz"
        description="Umsetzung und Betrieb der KI-Projekte – von Onboarding bis Optimierung."
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          label="Live-Projekte"
          value={formatNumber(live.length)}
          hint="im produktiven Betrieb"
          accent="success"
          icon={IconPhone}
        />
        <StatCard
          label="Im Onboarding"
          value={formatNumber(onboarding.length)}
          hint="Einrichtung läuft"
          accent="sky"
          icon={IconSpark}
        />
        <StatCard
          label="MRR aktiv"
          value={`${formatEur(mrr)}/M`}
          hint="laufender Projektumsatz"
          accent="brand"
          icon={IconEuro}
        />
        <StatCard
          label="Risiko-Projekte"
          value={formatNumber(risiko.length)}
          hint="benötigen Aufmerksamkeit"
          accent={risiko.length > 0 ? "warning" : "neutral"}
          icon={IconAlert}
        />
      </div>

      <KiProjectsView projects={projects} />
    </div>
  );
}
