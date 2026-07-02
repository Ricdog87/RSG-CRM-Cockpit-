import { getProjectRefs } from "@/lib/project-refs-data";
import { getMatchesOverview } from "@/lib/matches-data";
import { PageHeader } from "@/components/cockpit/PageHeader";
import { MatchWorkbench } from "@/components/cockpit/MatchWorkbench";
import { MatchPipeline } from "@/components/cockpit/MatchPipeline";
import { SyncProjectsButton } from "@/components/cockpit/SyncProjectsButton";
import { formatDate } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function MatchPage() {
  const [projects, matchGroups] = await Promise.all([getProjectRefs(), getMatchesOverview()]);
  const options = projects.map((p) => ({
    id: p.id,
    titel: p.titel,
    kunde: p.kunde,
    standort: p.standort,
  }));
  const lastSync = projects
    .map((p) => p.last_synced_at)
    .filter(Boolean)
    .sort()
    .pop();

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Search & Match"
        title="Kandidaten matchen"
        description={`HubSpot-Projekt wählen – passende, einwilligungsgeprüfte Kandidat:innen finden.${
          lastSync ? ` Zuletzt synchronisiert: ${formatDate(lastSync)}.` : ""
        }`}
        action={<SyncProjectsButton />}
      />
      <MatchWorkbench projects={options} />

      <PageHeader
        eyebrow="Pipeline"
        title="Laufende Matches"
        description="Kandidat:innen im Prozess je Projekt – Status direkt hier steuern."
      />
      <MatchPipeline groups={matchGroups} />
    </div>
  );
}
