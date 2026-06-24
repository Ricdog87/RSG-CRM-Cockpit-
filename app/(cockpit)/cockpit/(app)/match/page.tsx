import { getProjectRefs } from "@/lib/project-refs-data";
import { PageHeader } from "@/components/cockpit/PageHeader";
import { MatchWorkbench } from "@/components/cockpit/MatchWorkbench";

export const dynamic = "force-dynamic";

export default async function MatchPage() {
  const projects = await getProjectRefs();
  const options = projects.map((p) => ({
    id: p.id,
    titel: p.titel,
    kunde: p.kunde,
    standort: p.standort,
  }));

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Search & Match"
        title="Kandidaten matchen"
        description="HubSpot-Projekt wählen – passende, einwilligungsgeprüfte Kandidat:innen finden."
      />
      <MatchWorkbench projects={options} />
    </div>
  );
}
