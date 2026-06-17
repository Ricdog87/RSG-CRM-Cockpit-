import { getCockpitData } from "@/lib/data";
import {
  getOpportunities,
  getKiProjects,
  getMandates,
  getCandidates,
} from "@/lib/crm-data";
import { getOpenTasks } from "@/lib/tasks-data";
import { getUpcomingMilestones } from "@/lib/placements-data";
import { KpiRow } from "@/components/cockpit/KpiRow";
import { CrmOverview } from "@/components/cockpit/CrmOverview";
import { OverrideNudge } from "@/components/cockpit/OverrideNudge";
import { Pipeline } from "@/components/cockpit/Pipeline";
import { OpenMandates } from "@/components/cockpit/OpenMandates";
import { OneTimeRevenue } from "@/components/cockpit/OneTimeRevenue";
import { PlacementMilestones } from "@/components/cockpit/PlacementMilestones";
import { CareerProgress } from "@/components/cockpit/CareerProgress";
import { Leaderboard } from "@/components/cockpit/Leaderboard";
import { TeamDownline } from "@/components/cockpit/TeamDownline";
import { TodayAgenda } from "@/components/cockpit/TodayAgenda";
import { QuickActions } from "@/components/cockpit/QuickActions";

// Immer frisch rendern – Daten sind nutzer- und sessionspezifisch.
export const dynamic = "force-dynamic";

export default async function CockpitPage() {
  const [data, opportunities, kiProjects, mandates, candidates, openTasks, milestones] =
    await Promise.all([
      getCockpitData(),
      getOpportunities(),
      getKiProjects(),
      getMandates(),
      getCandidates(),
      getOpenTasks(),
      getUpcomingMilestones(),
    ]);

  return (
    <div className="space-y-6">
      {/* 1. Schnellzugriff */}
      <section className="animate-fade-up" aria-label="Schnellzugriff">
        <QuickActions />
      </section>

      {/* 2. Tagesordnung */}
      <section className="animate-fade-up" aria-label="Tagesordnung">
        <TodayAgenda tasks={openTasks} />
      </section>

      {/* 3. Pipeline (Deals) + offene Mandate (Suchaufträge) nebeneinander */}
      <div className="grid gap-6 lg:grid-cols-2">
        <section className="animate-fade-up" aria-label="Pipeline">
          <Pipeline deals={data.pipeline} limit={5} viewAllHref="/cockpit/pipeline" />
        </section>
        <section className="animate-fade-up" aria-label="Offene Mandate">
          <OpenMandates mandates={mandates} limit={5} />
        </section>
      </div>

      {/* 3b. Einmalumsatz + Platzierungs-Meilensteine */}
      <div className="grid gap-6 lg:grid-cols-2">
        <section className="animate-fade-up" aria-label="Einmalumsatz">
          <OneTimeRevenue kiProjects={kiProjects} mandates={mandates} />
        </section>
        <section className="animate-fade-up" aria-label="Platzierungs-Meilensteine">
          <PlacementMilestones milestones={milestones} />
        </section>
      </div>

      {/* 3. KPI-Reihe */}
      <section className="animate-fade-up" aria-label="Kennzahlen">
        <KpiRow
          bestand={data.bestand}
          earnings={data.earnings}
          provisionAktuellerMonat={data.provisionAktuellerMonat}
        />
      </section>

      {/* 4. CRM-Kennzahlen */}
      <section className="animate-fade-up" aria-label="Vertrieb & Projekte">
        <CrmOverview
          opportunities={opportunities}
          kiProjects={kiProjects}
          mandates={mandates}
          candidates={candidates}
        />
      </section>

      {/* 5. Override-Nudge */}
      <OverrideNudge earnings={data.earnings} override={data.override} />

      {/* 6. Team & Karriere */}
      <div className="grid gap-6 lg:grid-cols-3">
        <section className="animate-fade-up" aria-label="Karriere">
          <CareerProgress career={data.career} />
        </section>
        <section className="animate-fade-up" aria-label="Leaderboard">
          <Leaderboard rows={data.leaderboard} />
        </section>
        <section className="animate-fade-up" aria-label="Team">
          <TeamDownline team={data.downline} limit={3} viewAllHref="/cockpit/team" />
        </section>
      </div>
    </div>
  );
}
