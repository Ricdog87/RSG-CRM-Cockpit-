import { getCockpitData } from "@/lib/data";
import {
  getOpportunities,
  getKiProjects,
  getMandates,
  getCandidates,
} from "@/lib/crm-data";
import { getOpenTasks } from "@/lib/tasks-data";
import { KpiRow } from "@/components/cockpit/KpiRow";
import { CrmOverview } from "@/components/cockpit/CrmOverview";
import { OverrideNudge } from "@/components/cockpit/OverrideNudge";
import { Pipeline } from "@/components/cockpit/Pipeline";
import { CareerProgress } from "@/components/cockpit/CareerProgress";
import { Leaderboard } from "@/components/cockpit/Leaderboard";
import { TeamDownline } from "@/components/cockpit/TeamDownline";
import { TodayAgenda } from "@/components/cockpit/TodayAgenda";
import { QuickActions } from "@/components/cockpit/QuickActions";

// Immer frisch rendern – Daten sind nutzer- und sessionspezifisch.
export const dynamic = "force-dynamic";

export default async function CockpitPage() {
  const [data, opportunities, kiProjects, mandates, candidates, openTasks] =
    await Promise.all([
      getCockpitData(),
      getOpportunities(),
      getKiProjects(),
      getMandates(),
      getCandidates(),
      getOpenTasks(),
    ]);

  return (
    <div className="space-y-6">
      {/* 1. Schnellzugriff */}
      <section className="animate-fade-up" aria-label="Schnellzugriff">
        <QuickActions />
      </section>

      {/* 2. Tagesordnung + Pipeline */}
      <div className="grid gap-6 lg:grid-cols-3">
        <section className="animate-fade-up lg:col-span-2" aria-label="Tagesordnung">
          <TodayAgenda tasks={openTasks} />
        </section>
        <section className="animate-fade-up" aria-label="Pipeline">
          <Pipeline deals={data.pipeline} limit={5} viewAllHref="/cockpit/pipeline" />
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
