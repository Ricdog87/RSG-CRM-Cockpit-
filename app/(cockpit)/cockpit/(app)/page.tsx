import { getCockpitData, getPartnerIdentity } from "@/lib/data";
import { DashboardHero } from "@/components/cockpit/DashboardHero";import {
  getOpportunities,
  getKiProjects,
  getMandates,
  getCandidates,
  getAccounts,
} from "@/lib/crm-data";
import { getOpenTasks } from "@/lib/tasks-data";
import type { Deal, DealStage } from "@/lib/types";
import { mandateFeePerPosition, mandateRevenue, type SalesStage } from "@/lib/crm-types";
import { getUpcomingMilestones } from "@/lib/placements-data";
import { getInvoiceSummary } from "@/lib/invoices-data";
import { getActivityStats } from "@/lib/activity-data";
import { buildBriefing } from "@/lib/ai/briefing";
import { DailyBriefing } from "@/components/cockpit/DailyBriefing";
import { DailyGoals } from "@/components/cockpit/DailyGoals";
import { KpiRow } from "@/components/cockpit/KpiRow";
import { StatCard } from "@/components/cockpit/StatCard";
import { OverrideNudge } from "@/components/cockpit/OverrideNudge";
import { Pipeline } from "@/components/cockpit/Pipeline";
import { OpenMandates } from "@/components/cockpit/OpenMandates";
import { PlacementMilestones } from "@/components/cockpit/PlacementMilestones";
import { InvoiceSummaryCard } from "@/components/cockpit/InvoiceSummaryCard";
import { KiRenewals } from "@/components/cockpit/KiRenewals";
import { CareerProgress } from "@/components/cockpit/CareerProgress";
import { Leaderboard } from "@/components/cockpit/Leaderboard";
import { TeamDownline } from "@/components/cockpit/TeamDownline";
import { TodayAgenda } from "@/components/cockpit/TodayAgenda";
import { QuickActions } from "@/components/cockpit/QuickActions";
import { Card, CardBody } from "@/components/ui/Card";
import { IconBriefcase, IconEuro, IconUserCheck, IconTarget, IconPhone, IconBolt, IconTrendingUp } from "@/components/ui/icons";
import { formatEur, formatNumber } from "@/lib/format";

// Immer frisch rendern – Daten sind nutzer- und sessionspezifisch.
export const dynamic = "force-dynamic";

const SALES_TO_DEAL: Record<SalesStage, DealStage> = {
  neu: "neu",
  qualifiziert: "qualifiziert",
  demo: "qualifiziert",
  angebot: "angebot",
  verhandlung: "verhandlung",
  gewonnen: "gewonnen",
  verloren: "verloren",
};

function toDeal(o: {
  id: string;
  account_name: string;
  title: string;
  stage: SalesStage;
  value: number;
  probability: number;
  expected_close: string;
}): Deal {
  return {
    id: o.id,
    customer_name: o.account_name,
    product_name: o.title || o.account_name,
    stage: SALES_TO_DEAL[o.stage] ?? "neu",
    mrr_value: o.value,
    probability: o.probability,
    expected_close: o.expected_close || null,
    updated_at: "",
  };
}

/** Abschnitts-Kopf zur klaren Trennung der Geschäftslinien. */
function LineHeader({ eyebrow, title, accent }: { eyebrow: string; title: string; accent: string }) {
  return (
    <div className="flex items-center gap-3 pt-2">
      <span className={`h-7 w-1.5 flex-none rounded-full ${accent}`} />
      <div>
        <p className="text-[0.65rem] font-semibold uppercase tracking-wider text-faint">{eyebrow}</p>
        <h2 className="text-lg font-bold text-ink">{title}</h2>
      </div>
    </div>
  );
}

export default async function CockpitPage() {
  const [data, identity, opportunities, kiProjects, mandates, candidates, accounts, openTasks, milestones, invoiceSummary, activityStats, briefing] =
    await Promise.all([
      getCockpitData(),
      getPartnerIdentity(),
      getOpportunities(),
      getKiProjects(),
      getMandates(),
      getCandidates(),
      getAccounts(),
      getOpenTasks(),
      getUpcomingMilestones(),
      getInvoiceSummary(),
      getActivityStats(),
      buildBriefing(),
    ]);

  // ── Tagesziele / Streak / Wochenübersicht (Arbeitswoche Mo–Do) ────────
  const dKey = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const nowD = new Date();
  const todayKey = dKey(nowD);
  const recDates = new Set(mandates.filter((m) => m.created_at).map((m) => dKey(new Date(m.created_at!))));
  const kiDates = new Set(kiProjects.filter((p) => p.created_at).map((p) => dKey(new Date(p.created_at!))));
  const newRecruitingToday = recDates.has(todayKey);
  const newKiToday = kiDates.has(todayKey);

  const dayScore = (key: string) => {
    const a = activityStats.daily[key] ?? { call: 0, email: 0 };
    return (a.call >= 15 ? 1 : 0) + (a.email >= 10 ? 1 : 0) + (recDates.has(key) ? 1 : 0) + (kiDates.has(key) ? 1 : 0);
  };

  // Streak: zusammenhängende Arbeitstage (Mo–Do) mit allen 4 Zielen erreicht.
  let streak = 0;
  for (let i = 0; i < 60; i++) {
    const d = new Date(nowD);
    d.setDate(nowD.getDate() - i);
    const wd = d.getDay();
    if (wd < 1 || wd > 4) continue; // nur Mo–Do
    const sc = dayScore(dKey(d));
    if (i === 0 && sc < 4) continue; // heute zählt nicht als Bruch
    if (sc >= 4) streak++;
    else break;
  }

  // Wochenübersicht Mo–So.
  const weekStart = new Date(nowD);
  weekStart.setDate(nowD.getDate() - ((nowD.getDay() + 6) % 7));
  const dayLabels = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];
  const weekDays = Array.from({ length: 7 }).map((_, i) => {
    const d = new Date(weekStart);
    d.setDate(weekStart.getDate() + i);
    const key = dKey(d);
    const wd = d.getDay();
    const mode: "goal" | "review" | "off" = wd >= 1 && wd <= 4 ? "goal" : wd === 5 ? "review" : "off";
    return {
      label: dayLabels[i],
      mode,
      score: mode === "goal" ? dayScore(key) : 0,
      isToday: key === todayKey,
      isFuture: d.getTime() > nowD.getTime() && key !== todayKey,
    };
  });
  const todayMode: "work" | "review" | "off" =
    nowD.getDay() >= 1 && nowD.getDay() <= 4 ? "work" : nowD.getDay() === 5 ? "review" : "off";
  const goalsDoneToday =
    (activityStats.callsToday >= 15 ? 1 : 0) +
    (activityStats.emailsToday >= 10 ? 1 : 0) +
    (newRecruitingToday ? 1 : 0) +
    (newKiToday ? 1 : 0);

  // Kombinierter Forecast (Gesamt-Pipeline): Recruiting-Honorar-Angebote +
  // KI-MRR-Angebote ×12 (ARR-Sicht).
  const recruitingForecastTotal = mandates
    .filter((m) => m.status === "angebot")
    .reduce((s, m) => s + mandateRevenue(m), 0);
  const kiForecastArr = kiProjects
    .filter((p) => p.status === "angebot")
    .reduce((s, p) => s + p.mrr * 12, 0);
  const totalPipeline = recruitingForecastTotal + kiForecastArr;

  const aktiveKunden = accounts.filter((a) => a.lifecycle === "kunde" || a.lifecycle === "bestand").length;

  // ── Recruiting-Kennzahlen ────────────────────────────────────────────
  const recruitingDeals = opportunities.filter((o) => o.line === "recruiting").map(toDeal);
  // „Angebot / Planung" = Forecast, nicht gewonnen.
  const wonMandates = mandates.filter((m) => m.status !== "angebot");
  const offeneStellen = wonMandates.reduce((s, m) => s + Math.max(0, m.positions - m.filled), 0);
  const offeneMandate = wonMandates.filter((m) => m.status !== "besetzt" && m.filled < m.positions).length;
  const offenesHonorar = wonMandates.reduce(
    (s, m) => s + Math.max(0, m.positions - m.filled) * mandateFeePerPosition(m),
    0
  );
  const recruitingForecast = mandates
    .filter((m) => m.status === "angebot")
    .reduce((s, m) => s + mandateRevenue(m), 0);
  const aktiveKandidaten = candidates.filter((c) => c.stage !== "platziert" && c.stage !== "abgelehnt").length;

  // ── KI-Kennzahlen ────────────────────────────────────────────────────
  const kiDeals = opportunities.filter((o) => o.line === "ki").map(toDeal);
  // Aktiv = gewonnen & laufend (Status „Angebot" zählt als Forecast, nicht als MRR).
  const kiActive = kiProjects.filter((p) => p.status !== "gekuendigt" && p.status !== "angebot");
  const kiLive = kiProjects.filter((p) => p.status === "live").length;
  const kiOnboarding = kiProjects.filter((p) => p.status === "onboarding").length;
  const kiMrr = kiActive.reduce((s, p) => s + p.mrr, 0);
  const kiArr = kiMrr * 12;
  const kiSetup = kiActive.reduce((s, p) => s + (p.setup_fee ?? 0), 0);
  const kiForecast = kiProjects.filter((p) => p.status === "angebot").reduce((s, p) => s + p.mrr, 0);

  return (
    <div className="space-y-6">
      <section className="animate-fade-up" aria-label="Begrüßung">
        <DashboardHero name={identity.display_name} goalsDone={goalsDoneToday} streak={streak} dayMode={todayMode} />
      </section>

      <section className="animate-fade-up" aria-label="Tages-Briefing">
        <DailyBriefing signals={briefing.signals} counts={briefing.counts} atRisk={briefing.atRisk} />
      </section>

      <section className="animate-fade-up" aria-label="Schnellzugriff">
        <QuickActions />
      </section>

      {/* Tagesziele (spielerisch) + Tagesordnung */}
      <div className="grid gap-6 lg:grid-cols-3">
        <section className="animate-fade-up lg:col-span-2" aria-label="Tagesziele">
          <DailyGoals
            stats={activityStats}
            newRecruitingToday={newRecruitingToday}
            newKiToday={newKiToday}
            streak={streak}
            weekDays={weekDays}
            dayMode={todayMode}
            callGoalWeek={60}
            emailGoalWeek={40}
            accounts={accounts.map((a) => a.name)}
          />
        </section>
        <section className="animate-fade-up" aria-label="Tagesordnung">
          <TodayAgenda tasks={openTasks} />
        </section>
      </div>

      {/* Gesamt-Pipeline (kombinierter Forecast über beide Linien) */}
      <section className="animate-fade-up" aria-label="Gesamt-Pipeline">
        <Card className="border-brand/30 bg-gradient-to-br from-brand/[0.06] to-sky/[0.05]">
          <CardBody className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-[0.65rem] font-semibold uppercase tracking-wider text-brand-deep">
                Gesamt-Pipeline · Forecast
              </p>
              <p className="mt-1 text-3xl font-black tracking-tight text-ink">{formatEur(totalPipeline)}</p>
              <p className="mt-0.5 text-xs text-muted">
                Recruiting-Honorar-Angebote + KI-MRR-Angebote ×12 (ARR-Sicht)
              </p>
            </div>
            <div className="flex gap-6 text-right text-sm">
              <div>
                <p className="text-xs text-faint">Recruiting</p>
                <p className="font-bold text-ink">{formatEur(recruitingForecastTotal)}</p>
              </div>
              <div>
                <p className="text-xs text-faint">KI (ARR)</p>
                <p className="font-bold text-ink">{formatEur(kiForecastArr)}</p>
              </div>
            </div>
          </CardBody>
        </Card>
      </section>

      {/* ═══════════ RSG Recruiting ═══════════ */}
      <LineHeader eyebrow="Geschäftslinie · Personalvermittlung" title="RSG Recruiting" accent="bg-brand" />
      <section className="animate-fade-up" aria-label="Recruiting-Kennzahlen">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
          <StatCard label="Offene Mandate" value={formatNumber(offeneMandate)} hint={`${formatNumber(offeneStellen)} offene Stellen`} accent="brand" icon={IconBriefcase} />
          <StatCard label="Offenes Honorar" value={formatEur(offenesHonorar)} hint="noch zu besetzen" accent="warning" icon={IconEuro} />
          <StatCard label="Forecast (Angebot)" value={formatEur(recruitingForecast)} hint="in Planung/Angebot" accent="neutral" icon={IconTrendingUp} />
          <StatCard label="Aktive Kandidat:innen" value={formatNumber(aktiveKandidaten)} hint="in Prozess" accent="sky" icon={IconUserCheck} />
          <StatCard label="Offene Rechnungen" value={formatEur(invoiceSummary.outstanding)} hint={invoiceSummary.overdue > 0 ? `${formatEur(invoiceSummary.overdue)} überfällig` : "gestellt"} accent={invoiceSummary.overdue > 0 ? "warning" : "success"} icon={IconEuro} />
        </div>
      </section>
      <div className="grid gap-6 lg:grid-cols-2">
        <section className="animate-fade-up" aria-label="Offene Mandate">
          <OpenMandates mandates={mandates} limit={5} />
        </section>
        <section className="animate-fade-up" aria-label="Platzierungs-Meilensteine">
          <PlacementMilestones milestones={milestones} />
        </section>
        <section className="animate-fade-up" aria-label="Honorar-Rechnungen">
          <InvoiceSummaryCard summary={invoiceSummary} />
        </section>
        <section className="animate-fade-up" aria-label="Recruiting-Verkaufschancen">
          <Pipeline deals={recruitingDeals} title="Recruiting-Pipeline" limit={5} viewAllHref="/cockpit/sales" />
        </section>
      </div>

      {/* ═══════════ RSG AI ═══════════ */}
      <LineHeader eyebrow="Geschäftslinie · KI & Telefonassistenz" title="RSG AI" accent="bg-sky" />
      <section className="animate-fade-up" aria-label="KI-Kennzahlen">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
          <StatCard label="MRR aktiv" value={`${formatEur(kiMrr)}/M`} hint="wiederkehrend" accent="brand" icon={IconEuro} />
          <StatCard label="ARR" value={formatEur(kiArr)} hint="Jahresumsatz (MRR×12)" accent="sky" icon={IconTrendingUp} />
          <StatCard label="Forecast (Angebot)" value={`${formatEur(kiForecast)}/M`} hint="in Planung/Angebot" accent="neutral" icon={IconTrendingUp} />
          <StatCard label="Live-Projekte" value={formatNumber(kiLive)} hint={`${formatNumber(kiOnboarding)} im Onboarding`} accent="success" icon={IconPhone} />
          <StatCard label="Implementierung" value={formatEur(kiSetup)} hint="einmalig (aktiv)" accent="warning" icon={IconBolt} />
        </div>
      </section>
      <div className="grid gap-6 lg:grid-cols-2">
        <section className="animate-fade-up" aria-label="Renewals & Churn">
          <KiRenewals projects={kiProjects} />
        </section>
        <section className="animate-fade-up" aria-label="KI-Verkaufschancen">
          <Pipeline deals={kiDeals} title="KI-Pipeline" limit={5} viewAllHref="/cockpit/sales" />
        </section>
      </div>

      {/* ═══════════ Deine Vergütung ═══════════ */}
      <LineHeader eyebrow="Persönlich · Provision & Bestand" title="Deine Vergütung" accent="bg-success" />
      <section className="animate-fade-up" aria-label="Vergütung">
        <KpiRow
          bestand={data.bestand}
          earnings={data.earnings}
          provisionAktuellerMonat={data.provisionAktuellerMonat}
          aktiveKunden={aktiveKunden}
        />
      </section>
      <OverrideNudge earnings={data.earnings} override={data.override} />

      {/* ═══════════ Team & Karriere ═══════════ */}
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
