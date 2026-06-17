import { getCockpitData } from "@/lib/data";
import {
  getOpportunities,
  getKiProjects,
  getMandates,
  getCandidates,
  getAccounts,
} from "@/lib/crm-data";
import { getOpenTasks } from "@/lib/tasks-data";
import type { Deal, DealStage } from "@/lib/types";
import type { SalesStage } from "@/lib/crm-types";
import { getUpcomingMilestones } from "@/lib/placements-data";
import { getInvoiceSummary } from "@/lib/invoices-data";
import { KpiRow } from "@/components/cockpit/KpiRow";
import { CrmOverview } from "@/components/cockpit/CrmOverview";
import { OverrideNudge } from "@/components/cockpit/OverrideNudge";
import { Pipeline } from "@/components/cockpit/Pipeline";
import { OpenMandates } from "@/components/cockpit/OpenMandates";
import { OneTimeRevenue } from "@/components/cockpit/OneTimeRevenue";
import { PlacementMilestones } from "@/components/cockpit/PlacementMilestones";
import { InvoiceSummaryCard } from "@/components/cockpit/InvoiceSummaryCard";
import { KiRenewals } from "@/components/cockpit/KiRenewals";
import { CareerProgress } from "@/components/cockpit/CareerProgress";
import { Leaderboard } from "@/components/cockpit/Leaderboard";
import { TeamDownline } from "@/components/cockpit/TeamDownline";
import { TodayAgenda } from "@/components/cockpit/TodayAgenda";
import { QuickActions } from "@/components/cockpit/QuickActions";

// Immer frisch rendern – Daten sind nutzer- und sessionspezifisch.
export const dynamic = "force-dynamic";

// Sales-Phase → Deal-Phase fürs Pipeline-Widget.
const SALES_TO_DEAL: Record<SalesStage, DealStage> = {
  neu: "neu",
  qualifiziert: "qualifiziert",
  demo: "qualifiziert",
  angebot: "angebot",
  verhandlung: "verhandlung",
  gewonnen: "gewonnen",
  verloren: "verloren",
};

export default async function CockpitPage() {
  const [data, opportunities, kiProjects, mandates, candidates, accounts, openTasks, milestones, invoiceSummary] =
    await Promise.all([
      getCockpitData(),
      getOpportunities(),
      getKiProjects(),
      getMandates(),
      getCandidates(),
      getAccounts(),
      getOpenTasks(),
      getUpcomingMilestones(),
      getInvoiceSummary(),
    ]);

  // Pipeline aus den CRM-Verkaufschancen speisen (statt der leeren deals-Tabelle).
  const pipelineDeals: Deal[] = opportunities.map((o) => ({
    id: o.id,
    customer_name: o.account_name,
    product_name: o.title || o.account_name,
    stage: SALES_TO_DEAL[o.stage] ?? "neu",
    mrr_value: o.value,
    probability: o.probability,
    expected_close: o.expected_close || null,
    updated_at: "",
  }));
  // Echte aktive Kund:innen aus dem CRM (Kunde/Bestand).
  const aktiveKunden = accounts.filter(
    (a) => a.lifecycle === "kunde" || a.lifecycle === "bestand"
  ).length;

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
          <Pipeline deals={pipelineDeals} limit={5} viewAllHref="/cockpit/sales" />
        </section>
        <section className="animate-fade-up" aria-label="Offene Mandate">
          <OpenMandates mandates={mandates} limit={5} />
        </section>
      </div>

      {/* 3b. Einmalumsatz + Meilensteine + Rechnungen + KI-Renewals */}
      <div className="grid gap-6 lg:grid-cols-2">
        <section className="animate-fade-up" aria-label="Einmalumsatz">
          <OneTimeRevenue kiProjects={kiProjects} mandates={mandates} />
        </section>
        <section className="animate-fade-up" aria-label="Platzierungs-Meilensteine">
          <PlacementMilestones milestones={milestones} />
        </section>
        <section className="animate-fade-up" aria-label="Rechnungen">
          <InvoiceSummaryCard summary={invoiceSummary} />
        </section>
        <section className="animate-fade-up" aria-label="Renewals & Churn">
          <KiRenewals projects={kiProjects} />
        </section>
      </div>

      {/* 3. KPI-Reihe */}
      <section className="animate-fade-up" aria-label="Kennzahlen">
        <KpiRow
          bestand={data.bestand}
          earnings={data.earnings}
          provisionAktuellerMonat={data.provisionAktuellerMonat}
          aktiveKunden={aktiveKunden}
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
