import Link from "next/link";
import { getPartnerIdentity } from "@/lib/data";
import { getCandidates } from "@/lib/crm-data";
import { getOpenTasks } from "@/lib/tasks-data";
import { getActivityStats } from "@/lib/activity-data";
import { getMatchStats } from "@/lib/matches-data";
import { getRecentConsents } from "@/lib/consent-data";
import { DashboardHero } from "@/components/cockpit/DashboardHero";
import { WeeklyReview } from "@/components/cockpit/WeeklyReview";
import { DailyGoals } from "@/components/cockpit/DailyGoals";
import { StatCard } from "@/components/cockpit/StatCard";
import { TodayAgenda } from "@/components/cockpit/TodayAgenda";
import { QuickActions } from "@/components/cockpit/QuickActions";
import { Card, CardBody, SectionHeader } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { IconUsers, IconUserCheck, IconTarget, IconTrendingUp, IconChevronRight } from "@/components/ui/icons";
import { formatNumber, formatDate } from "@/lib/format";
import { availabilityMeta } from "@/lib/candidate-status";

// Immer frisch rendern – Daten sind nutzer- und sessionspezifisch.
export const dynamic = "force-dynamic";

const dKey = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

export default async function CockpitPage() {
  const nowD = new Date();
  const todayKey = dKey(nowD);
  const weekStart = new Date(nowD);
  weekStart.setDate(nowD.getDate() - ((nowD.getDay() + 6) % 7));
  weekStart.setHours(0, 0, 0, 0);
  const weekStartIso = weekStart.toISOString();
  const since60 = new Date(nowD.getTime() - 60 * 86400000).toISOString();

  const [identity, candidates, openTasks, activityStats, matchStats, recentConsents] = await Promise.all([
    getPartnerIdentity(),
    getCandidates(),
    getOpenTasks(),
    getActivityStats(),
    getMatchStats(weekStartIso),
    getRecentConsents(since60),
  ]);

  // ── Tagesziele / Streak / Wochenübersicht (Arbeitswoche Mo–Do) ────────
  const candDates = new Set(candidates.filter((c) => c.created_at).map((c) => dKey(new Date(c.created_at!))));
  // Anfrage-Tage (pending) für das Tagesziel „Einwilligung angefragt".
  const consentReqDates = new Set(
    recentConsents.filter((r) => r.status === "pending" && r.created_at).map((r) => dKey(new Date(r.created_at!)))
  );
  const newCandidateToday = candDates.has(todayKey);
  const consentRequestedToday = consentReqDates.has(todayKey);

  const dayScore = (key: string) => {
    const a = activityStats.daily[key] ?? { call: 0, email: 0 };
    return (a.call >= 15 ? 1 : 0) + (a.email >= 10 ? 1 : 0) + (candDates.has(key) ? 1 : 0) + (consentReqDates.has(key) ? 1 : 0);
  };

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
    (newCandidateToday ? 1 : 0) +
    (consentRequestedToday ? 1 : 0);

  // ── Kandidaten-Kennzahlen ────────────────────────────────────────────
  const total = candidates.length;
  const aktivVerfuegbar = candidates.filter((c) => c.availability_status === "AKTIV_VERFUEGBAR").length;
  const inVermittlung = candidates.filter((c) => c.availability_status === "IN_VERMITTLUNG").length;
  const inWeek = (iso?: string) => !!iso && new Date(iso).getTime() >= weekStart.getTime();
  const newThisWeek = candidates.filter((c) => inWeek(c.created_at)).length;
  const grantedThisWeek = recentConsents.filter((r) => inWeek(r.granted_at ?? undefined)).length;

  const recentCandidates = [...candidates]
    .filter((c) => c.created_at)
    .sort((a, b) => (b.created_at ?? "").localeCompare(a.created_at ?? ""))
    .slice(0, 6);

  const weeklyReviewInput = {
    calls: activityStats.weekCalls,
    emails: activityStats.weekEmails,
    kiActivities: activityStats.week.ki.call + activityStats.week.ki.email,
    recruitingActivities: activityStats.week.recruiting.call + activityStats.week.recruiting.email,
    newCandidates: newThisWeek,
    consentsGranted: grantedThisWeek,
    presentations: matchStats.weekNew,
    atRisk: 0,
    kritisch: 0,
    wichtig: 0,
  };

  return (
    <div className="space-y-6">
      <section className="animate-fade-up" aria-label="Begrüßung">
        <DashboardHero name={identity.display_name} goalsDone={goalsDoneToday} streak={streak} dayMode={todayMode} />
      </section>

      <section className="animate-fade-up" aria-label="Schnellzugriff">
        <QuickActions />
      </section>

      {todayMode !== "work" ? (
        <section className="animate-fade-up" aria-label="Wochen-Review">
          <WeeklyReview input={weeklyReviewInput} />
        </section>
      ) : null}

      {/* Kandidaten-KPIs */}
      <section className="animate-fade-up" aria-label="Kandidaten-Kennzahlen">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatCard label="Kandidat:innen" value={formatNumber(total)} hint="in der Datenbank" accent="brand" icon={IconUsers} href="/cockpit/kandidaten" />
          <StatCard label="Aktiv verfügbar" value={formatNumber(aktivVerfuegbar)} hint={`${formatNumber(inVermittlung)} in Vermittlung`} accent="success" icon={IconUserCheck} href="/cockpit/kandidaten" />
          <StatCard label="Offene Matches" value={formatNumber(matchStats.open)} hint="vorgeschlagen/vorgestellt" accent="sky" icon={IconTarget} href="/cockpit/match" />
          <StatCard label="Neu diese Woche" value={formatNumber(newThisWeek)} hint={`${formatNumber(grantedThisWeek)} Einwilligungen erteilt`} accent="warning" icon={IconTrendingUp} />
        </div>
      </section>

      {/* Tagesziele + Tagesordnung */}
      <div className="grid gap-6 lg:grid-cols-3">
        <section className="animate-fade-up lg:col-span-2" aria-label="Tagesziele">
          <DailyGoals
            stats={activityStats}
            newCandidateToday={newCandidateToday}
            consentRequestedToday={consentRequestedToday}
            streak={streak}
            weekDays={weekDays}
            dayMode={todayMode}
            callGoalWeek={60}
            emailGoalWeek={40}
          />
        </section>
        <section className="animate-fade-up" aria-label="Tagesordnung">
          <TodayAgenda tasks={openTasks} />
        </section>
      </div>

      {/* Zuletzt erfasste Kandidat:innen */}
      <section className="animate-fade-up" aria-label="Zuletzt erfasst">
        <Card>
          <CardBody>
            <SectionHeader
              title="Zuletzt erfasst"
              hint="neueste Kandidat:innen"
              action={
                <Link href="/cockpit/kandidaten" className="text-xs font-semibold text-brand-deep hover:underline">
                  Alle ansehen
                </Link>
              }
            />
            {recentCandidates.length === 0 ? (
              <EmptyState title="Noch keine Kandidat:innen. Leg die erste Person an." />
            ) : (
              <ul className="divide-y divide-border">
                {recentCandidates.map((c) => (
                  <li key={c.id}>
                    <Link
                      href={`/cockpit/kandidaten/${c.id}`}
                      className="group flex items-center justify-between gap-3 py-2.5"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-ink group-hover:text-brand-deep">{c.name}</p>
                        <p className="truncate text-xs text-faint">
                          {[c.role, c.location].filter(Boolean).join(" · ") || "—"}
                          {c.created_at ? ` · ${formatDate(c.created_at)}` : ""}
                        </p>
                      </div>
                      <div className="flex flex-none items-center gap-2">
                        <Badge tone={availabilityMeta(c.availability_status).tone} size="sm">
                          {availabilityMeta(c.availability_status).label}
                        </Badge>
                        <IconChevronRight size={16} className="text-faint" />
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>
      </section>
    </div>
  );
}
