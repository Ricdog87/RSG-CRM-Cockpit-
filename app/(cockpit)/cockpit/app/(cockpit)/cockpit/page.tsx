import Link from "next/link";
import { getAccounts } from "@/lib/crm-data";
import { getOpportunities } from "@/lib/crm-data";
import { getKiProjects } from "@/lib/crm-data";
import { getMandates } from "@/lib/crm-data";
import { getCandidates } from "@/lib/crm-data";
import { createClient } from "@/lib/supabase/server";
import { useMockData } from "@/lib/env";

async function getDashboardTasks() {
  if (useMockData) return [];
  try {
    const supabase = createClient();
    const today = new Date().toISOString().slice(0, 10);
    const next7 = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);
    const { data } = await supabase
      .from("crm_tasks")
      .select("id, title, due_date, related_label, done")
      .eq("done", false)
      .lte("due_date", next7)
      .order("due_date", { ascending: true })
      .limit(8);
    return (data as Array<{
      id: string;
      title: string;
      due_date: string | null;
      related_label: string | null;
      done: boolean;
    }> | null) ?? [];
  } catch {
    return [];
  }
}

export default async function CockpitDashboard() {
  const [accounts, opps, kiProjects, mandates, candidates, tasks] =
    await Promise.all([
      getAccounts(),
      getOpportunities(),
      getKiProjects(),
      getMandates(),
      getCandidates(),
      getDashboardTasks(),
    ]);

  // KPIs berechnen
  const totalMrr = kiProjects
    .filter((p) => p.status === "aktiv")
    .reduce((s, p) => s + (p.mrr ?? 0), 0);
  const activeKi = kiProjects.filter((p) => p.status === "aktiv").length;
  const openMandates = mandates.filter((m) => m.status === "offen").length;
  const pipelineValue = opps
    .filter((o) => o.stage !== "verloren" && o.stage !== "gewonnen")
    .reduce((s, o) => s + (o.value ?? 0), 0);
  const realAccounts = accounts.filter((a) => !("synthetic" in a && a.synthetic));
  const newCandidates = candidates.filter((c) => c.stage === "neu").length;

  const today = new Date().toISOString().slice(0, 10);

  function fmtMrr(v: number) {
    if (v >= 1000) return `€${(v / 1000).toFixed(1)}k`;
    return `€${v}`;
  }
  function fmtDate(d: string | null) {
    if (!d) return "–";
    const dt = new Date(d);
    const isToday = d === today;
    const isPast = d < today;
    if (isToday) return "Heute";
    if (isPast) return `⚠ ${dt.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit" })}`;
    return dt.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit" });
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-8">

      {/* Header */}
      <div>
        <h1 className="text-2xl font-medium text-gray-900 dark:text-gray-100">
          Dashboard
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          {new Date().toLocaleDateString("de-DE", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
        </p>
      </div>

      {/* KPI-Kacheln */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <Link href="/cockpit/projekte/ki" className="group">
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-4 hover:border-blue-400 transition-colors">
            <p className="text-xs text-gray-500 mb-1">KI-MRR aktiv</p>
            <p className="text-2xl font-medium text-gray-900 dark:text-gray-100">{fmtMrr(totalMrr)}</p>
            <p className="text-xs text-gray-400 mt-1">{activeKi} Projekte</p>
          </div>
        </Link>
        <Link href="/cockpit/kunden" className="group">
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-4 hover:border-blue-400 transition-colors">
            <p className="text-xs text-gray-500 mb-1">Kunden</p>
            <p className="text-2xl font-medium text-gray-900 dark:text-gray-100">{realAccounts.length}</p>
            <p className="text-xs text-gray-400 mt-1">Accounts</p>
          </div>
        </Link>
        <Link href="/cockpit/sales" className="group">
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-4 hover:border-blue-400 transition-colors">
            <p className="text-xs text-gray-500 mb-1">Pipeline</p>
            <p className="text-2xl font-medium text-gray-900 dark:text-gray-100">{fmtMrr(pipelineValue)}</p>
            <p className="text-xs text-gray-400 mt-1">{opps.filter(o => o.stage !== "verloren" && o.stage !== "gewonnen").length} Chancen</p>
          </div>
        </Link>
        <Link href="/cockpit/projekte/recruiting" className="group">
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-4 hover:border-blue-400 transition-colors">
            <p className="text-xs text-gray-500 mb-1">Mandate</p>
            <p className="text-2xl font-medium text-gray-900 dark:text-gray-100">{openMandates}</p>
            <p className="text-xs text-gray-400 mt-1">offen</p>
          </div>
        </Link>
        <Link href="/cockpit/kandidaten" className="group">
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-4 hover:border-blue-400 transition-colors">
            <p className="text-xs text-gray-500 mb-1">Kandidaten</p>
            <p className="text-2xl font-medium text-gray-900 dark:text-gray-100">{candidates.length}</p>
            <p className="text-xs text-gray-400 mt-1">{newCandidates} neu</p>
          </div>
        </Link>
        <Link href="/cockpit/aufgaben" className="group">
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-4 hover:border-blue-400 transition-colors">
            <p className="text-xs text-gray-500 mb-1">Aufgaben</p>
            <p className="text-2xl font-medium text-gray-900 dark:text-gray-100">{tasks.length}</p>
            <p className="text-xs text-gray-400 mt-1">nächste 7 Tage</p>
          </div>
        </Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Anstehende Aufgaben */}
        <div className="lg:col-span-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-medium text-gray-700 dark:text-gray-300">Nächste Aufgaben</h2>
            <Link href="/cockpit/aufgaben" className="text-xs text-blue-600 hover:underline">Alle →</Link>
          </div>
          {tasks.length === 0 ? (
            <p className="text-sm text-gray-400 py-4 text-center">Keine offenen Aufgaben in den nächsten 7 Tagen</p>
          ) : (
            <div className="space-y-2">
              {tasks.map((t) => {
                const isPast = t.due_date && t.due_date < today;
                return (
                  <div key={t.id} className="flex items-start gap-3 py-2 border-b border-gray-100 dark:border-gray-800 last:border-0">
                    <div className={`mt-0.5 w-2 h-2 rounded-full flex-shrink-0 ${isPast ? "bg-red-400" : t.due_date === today ? "bg-amber-400" : "bg-blue-400"}`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-gray-800 dark:text-gray-200 truncate">{t.title}</p>
                      {t.related_label && (
                        <p className="text-xs text-gray-400 truncate">{t.related_label}</p>
                      )}
                    </div>
                    <span className={`text-xs flex-shrink-0 ${isPast ? "text-red-500 font-medium" : "text-gray-400"}`}>
                      {fmtDate(t.due_date)}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Quick Actions + Status */}
        <div className="space-y-4">
          {/* Quick Actions */}
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-5">
            <h2 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Schnellzugriff</h2>
            <div className="space-y-2">
              <Link href="/cockpit/kunden" className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300 hover:text-blue-600 py-1.5 border-b border-gray-100 dark:border-gray-800">
                <span className="text-base">🏢</span> Neuer Kunde
              </Link>
              <Link href="/cockpit/kandidaten" className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300 hover:text-blue-600 py-1.5 border-b border-gray-100 dark:border-gray-800">
                <span className="text-base">👤</span> Neuer Kandidat
              </Link>
              <Link href="/cockpit/sales" className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300 hover:text-blue-600 py-1.5 border-b border-gray-100 dark:border-gray-800">
                <span className="text-base">📊</span> Sales Pipeline
              </Link>
              <Link href="/cockpit/projekte/recruiting" className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300 hover:text-blue-600 py-1.5 border-b border-gray-100 dark:border-gray-800">
                <span className="text-base">📋</span> Neues Mandat
              </Link>
              <Link href="/cockpit/projekte/ki" className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300 hover:text-blue-600 py-1.5 border-b border-gray-100 dark:border-gray-800">
                <span className="text-base">🤖</span> KI-Projekte
              </Link>
              <Link href="/cockpit/kalender" className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300 hover:text-blue-600 py-1.5">
                <span className="text-base">📅</span> Kalender
              </Link>
            </div>
          </div>

          {/* KI-Projekte Health */}
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-5">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-medium text-gray-700 dark:text-gray-300">KI-Projekte Status</h2>
              <Link href="/cockpit/projekte/ki" className="text-xs text-blue-600 hover:underline">Details →</Link>
            </div>
            <div className="space-y-1.5">
              {[
                { label: "Aktiv", count: kiProjects.filter(p => p.status === "aktiv").length, color: "bg-green-400" },
                { label: "Onboarding", count: kiProjects.filter(p => p.status === "onboarding").length, color: "bg-blue-400" },
                { label: "Gekündigt", count: kiProjects.filter(p => p.status === "gekündigt" || p.status === "churned").length, color: "bg-red-400" },
              ].map((item) => (
                <div key={item.label} className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${item.color}`} />
                  <span className="text-xs text-gray-600 dark:text-gray-400 flex-1">{item.label}</span>
                  <span className="text-xs font-medium text-gray-800 dark:text-gray-200">{item.count}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

      </div>

      {/* Sales Pipeline Mini-Übersicht */}
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-medium text-gray-700 dark:text-gray-300">Sales Pipeline</h2>
          <Link href="/cockpit/sales" className="text-xs text-blue-600 hover:underline">Vollansicht →</Link>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
          {(["neu", "kontaktiert", "angebot", "verhandlung", "gewonnen", "verloren"] as const).map((stage) => {
            const stageOpps = opps.filter((o) => o.stage === stage);
            const stageValue = stageOpps.reduce((s, o) => s + (o.value ?? 0), 0);
            const stageLabels: Record<string, string> = {
              neu: "Neu", kontaktiert: "Kontaktiert", angebot: "Angebot",
              verhandlung: "Verhandlung", gewonnen: "Gewonnen", verloren: "Verloren"
            };
            const stageColors: Record<string, string> = {
              neu: "bg-gray-100 dark:bg-gray-800",
              kontaktiert: "bg-blue-50 dark:bg-blue-950",
              angebot: "bg-amber-50 dark:bg-amber-950",
              verhandlung: "bg-purple-50 dark:bg-purple-950",
              gewonnen: "bg-green-50 dark:bg-green-950",
              verloren: "bg-red-50 dark:bg-red-950",
            };
            return (
              <div key={stage} className={`rounded-lg p-3 ${stageColors[stage]}`}>
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">{stageLabels[stage]}</p>
                <p className="text-lg font-medium text-gray-800 dark:text-gray-200">{stageOpps.length}</p>
                {stageValue > 0 && (
                  <p className="text-xs text-gray-400 mt-0.5">{fmtMrr(stageValue)}</p>
                )}
              </div>
            );
          })}
        </div>
      </div>

    </div>
  );
}
