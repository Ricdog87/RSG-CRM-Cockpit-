import "server-only";
import {
  getOpportunities,
  getKiProjects,
  getMandates,
  getCandidates,
  getAccounts,
} from "@/lib/crm-data";
import { getOpenTasks, type Task } from "@/lib/tasks-data";
import { getInvoiceSummary, type InvoiceSummary } from "@/lib/invoices-data";
import { mandateFeePerPosition } from "@/lib/crm-types";
import type {
  BusinessLine,
  Account,
  Opportunity,
  KiProject,
  RecruitingMandate,
  Candidate,
} from "@/lib/crm-types";

/**
 * Intelligentes Tages-Briefing: leitet aus den echten CRM-Daten die wichtigsten
 * Handlungssignale ab (überfällige Aufgaben, gefährdete Pipeline, Renewals,
 * fällige Mandate, offene Rechnungen, Kandidaten-Entscheidungen, kalte Leads).
 * Vollständig deterministisch – funktioniert ohne KI-Provider. Die KI-Schicht
 * (briefing-narrate) formuliert daraus optional ein motivierendes Coaching.
 */
export type BriefingSeverity = "kritisch" | "wichtig" | "chance";

export interface BriefingSignal {
  id: string;
  severity: BriefingSeverity;
  category: string;
  title: string;
  detail: string;
  action: string;
  href: string;
  line?: BusinessLine;
  /** € Wirkung (für Sortierung/Anzeige), 0 wenn n/a */
  value: number;
  /** interner Prioritäts-Score (Sortierung) */
  score: number;
}

export interface Briefing {
  signals: BriefingSignal[];
  generatedAt: string;
  counts: { kritisch: number; wichtig: number; chance: number };
  /** Summe gefährdeter/fälliger € (Pipeline, Renewals, Rechnungen) */
  atRisk: number;
}

const DAY = 86400000;

function daysUntil(iso?: string | null): number | null {
  if (!iso) return null;
  const t = new Date((iso.length <= 10 ? iso + "T00:00:00" : iso)).getTime();
  if (Number.isNaN(t)) return null;
  return Math.round((t - Date.now()) / DAY);
}

const sev: Record<BriefingSeverity, number> = { kritisch: 1000, wichtig: 500, chance: 200 };

/** Logarithmischer €-Bonus (deckelt sehr große Werte). */
function valueBonus(eur: number): number {
  if (eur <= 0) return 0;
  return Math.min(120, Math.round(Math.log10(eur + 1) * 30));
}

/** Vorgeladene Daten (z.B. vom Dashboard), um Doppel-Queries zu vermeiden. */
export interface BriefingInput {
  opportunities: Opportunity[];
  kiProjects: KiProject[];
  mandates: RecruitingMandate[];
  candidates: Candidate[];
  accounts: Account[];
  tasks: Task[];
  invoices: InvoiceSummary;
}

export async function buildBriefing(pre?: BriefingInput): Promise<Briefing> {
  const [opps, ki, mandates, candidates, accounts, tasks, invoices] = pre
    ? [pre.opportunities, pre.kiProjects, pre.mandates, pre.candidates, pre.accounts, pre.tasks, pre.invoices]
    : await Promise.all([
        getOpportunities(),
        getKiProjects(),
        getMandates(),
        getCandidates(),
        getAccounts(),
        getOpenTasks(),
        getInvoiceSummary(),
      ]);

  const signals: BriefingSignal[] = [];
  const push = (s: Omit<BriefingSignal, "score"> & { urgency?: number }) => {
    const { urgency = 0, ...rest } = s;
    signals.push({ ...rest, score: sev[s.severity] + urgency + valueBonus(s.value) });
  };

  // 1) Aufgaben: überfällig + heute fällig.
  for (const t of tasks) {
    const d = daysUntil(t.due_date);
    if (d == null) continue;
    const href =
      t.related_type === "customer" && t.related_id
        ? `/cockpit/kunden/${t.related_id}`
        : "/cockpit/aufgaben";
    if (d < 0) {
      push({
        id: `task-${t.id}`,
        severity: "kritisch",
        category: "Aufgabe",
        title: t.title,
        detail: `${Math.abs(d)} Tag(e) überfällig${t.related_label ? ` · ${t.related_label}` : ""}`,
        action: "Jetzt erledigen oder neu terminieren",
        href,
        value: 0,
        urgency: Math.min(300, Math.abs(d) * 20),
      });
    } else if (d === 0) {
      push({
        id: `task-${t.id}`,
        severity: "wichtig",
        category: "Aufgabe",
        title: t.title,
        detail: `heute fällig${t.related_label ? ` · ${t.related_label}` : ""}`,
        action: "Heute abschließen",
        href,
        value: 0,
        urgency: 120,
      });
    }
  }

  // 2) KI-Renewals & Churn-Risiko (Vertragsende ≤60T, Churn hoch, Health Risiko).
  for (const p of ki) {
    if (p.status === "gekuendigt" || p.status === "angebot") continue;
    const d = daysUntil(p.contract_end);
    const renewalSoon = d != null && d <= 60;
    const churnHigh = p.churn_risk === "hoch";
    const risiko = p.health === "risiko";
    if (!renewalSoon && !churnHigh && !risiko) continue;
    const arr = p.mrr * 12;
    const critical = churnHigh || (d != null && d <= 14);
    push({
      id: `ki-${p.id}`,
      severity: critical ? "kritisch" : "wichtig",
      category: "Renewal",
      title: `${p.account_name} – ${p.product || "KI-Projekt"}`,
      detail: churnHigh
        ? `Churn-Risiko hoch · ${formatMrr(p.mrr)} MRR`
        : renewalSoon
          ? `Verlängerung ${d != null ? (d < 0 ? `${Math.abs(d)} T überfällig` : `in ${d} T`) : "bald"} · ${formatMrr(p.mrr)} MRR`
          : `Health „Risiko" · ${formatMrr(p.mrr)} MRR`,
      action: churnHigh || risiko ? "Erfolgs-Call vereinbaren, Mehrwert sichern" : "Verlängerung anstoßen",
      href: `/cockpit/projekte/ki/${p.id}`,
      line: "ki",
      value: arr,
      urgency: d != null ? Math.max(0, 200 - Math.max(0, d) * 2) : 100,
    });
  }

  // 3) Pipeline: offene Chancen mit nahem/überfälligem erwartetem Abschluss.
  for (const o of opps) {
    if (o.stage === "gewonnen" || o.stage === "verloren") continue;
    const d = daysUntil(o.expected_close);
    if (d == null || d > 21) continue;
    const annual = o.value_type === "mrr" ? o.value * 12 : o.value;
    const overdue = d < 0;
    push({
      id: `opp-${o.id}`,
      severity: overdue ? "kritisch" : "wichtig",
      category: "Pipeline",
      title: `${o.account_name}${o.title ? ` – ${o.title}` : ""}`,
      detail: `${overdue ? `Abschluss ${Math.abs(d)} T überfällig` : `Abschluss in ${d} T`} · ${o.stage} · ${o.probability}%`,
      action: overdue ? "Entscheidung einholen oder Phase aktualisieren" : "Nachfassen und Abschluss terminieren",
      href: "/cockpit/sales",
      line: o.line,
      value: annual,
      urgency: overdue ? 220 : Math.max(0, 160 - d * 5),
    });
  }

  // 4) Recruiting-Mandate mit naher Deadline & offenen Stellen.
  // Echte Kandidatenzahl je Mandat (candidate_count ist denormalisiert/0).
  const mk = (s: string) => s.trim().toLowerCase().replace(/\s+/g, " ");
  const candCount = (m: RecruitingMandate) =>
    candidates.filter(
      (c) => (c.mandate_id && c.mandate_id === m.id) || (c.mandate_account && mk(c.mandate_account) === mk(m.account_name))
    ).length;
  for (const m of mandates) {
    if (m.status === "angebot" || m.status === "besetzt") continue;
    const offen = Math.max(0, m.positions - m.filled);
    if (offen <= 0) continue;
    const d = daysUntil(m.deadline);
    const dueSoon = d != null && d <= 21;
    const nCands = candCount(m);
    const fewCandidates = nCands < 3;
    if (!dueSoon && !fewCandidates) continue;
    const volumen = offen * mandateFeePerPosition(m);
    const overdue = d != null && d < 0;
    push({
      id: `mandate-${m.id}`,
      severity: overdue ? "kritisch" : "wichtig",
      category: "Recruiting",
      title: `${m.account_name} – ${m.role}`,
      detail: `${offen} offene Stelle(n)${d != null ? (overdue ? ` · ${Math.abs(d)} T überfällig` : ` · Deadline in ${d} T`) : ""} · ${nCands} Kandidat:innen`,
      action: fewCandidates ? "Pipeline füllen: aktiv sourcen & ansprechen" : "Kandidat:innen vorstellen, Interviews takten",
      href: "/cockpit/projekte/recruiting",
      line: "recruiting",
      value: volumen,
      urgency: overdue ? 200 : dueSoon ? Math.max(0, 150 - (d ?? 0) * 5) : 60,
    });
  }

  // 4b) Fixpreis-Zahlungen: Anzahlung offen (Suche gated) / Restzahlung offen.
  for (const m of mandates) {
    if ((m.pricing_model ?? "fixed") === "percent") continue;
    const positions = m.positions || 1;
    const depositTotal = (m.deposit ?? 0) * positions;
    const total = mandateFeePerPosition(m) * positions;
    const restTotal = Math.max(0, total - depositTotal);
    // Anzahlung offen bei aktivem Mandat → Suche startet erst nach Eingang.
    if (m.status !== "besetzt" && m.status !== "angebot" && m.status !== "pausiert" && depositTotal > 0 && !m.deposit_paid) {
      push({
        id: `dep-${m.id}`,
        severity: "wichtig",
        category: "Zahlung",
        title: `${m.account_name} – Anzahlung offen`,
        detail: `${formatEurShort(depositTotal)} Anzahlung ausstehend · Suche startet nach Eingang`,
        action: "Anzahlung nachhalten / anfordern, dann Suche starten",
        href: `/cockpit/projekte/recruiting`,
        line: "recruiting",
        value: depositTotal,
        urgency: 110,
      });
    }
    // Restzahlung offen bei besetztem Mandat → Geld steht aus.
    if (m.status === "besetzt" && restTotal > 0 && !m.final_paid) {
      push({
        id: `fin-${m.id}`,
        severity: "kritisch",
        category: "Zahlung",
        title: `${m.account_name} – Restzahlung offen`,
        detail: `${formatEurShort(restTotal)} Restzahlung nach Besetzung ausstehend`,
        action: "Restzahlung anfordern / Rechnung nachhalten",
        href: `/cockpit/projekte/recruiting`,
        line: "recruiting",
        value: restTotal,
        urgency: 190,
      });
    }
  }

  // 5) Überfällige Rechnungen.
  if (invoices.overdue > 0) {
    push({
      id: "inv-overdue",
      severity: "kritisch",
      category: "Rechnung",
      title: "Überfällige Honorar-Rechnungen",
      detail: `${formatEurShort(invoices.overdue)} überfällig von ${formatEurShort(invoices.outstanding)} offen`,
      action: "Zahlungserinnerung senden / nachhaken",
      href: "/cockpit/projekte/recruiting",
      value: invoices.overdue,
      urgency: 180,
    });
  }

  // 6) Kandidat:innen in Interview-Phase (Entscheidung treiben).
  const interviewing = candidates.filter((c) => c.stage === "interview");
  if (interviewing.length > 0) {
    push({
      id: "cand-interview",
      severity: "wichtig",
      category: "Kandidaten",
      title: `${interviewing.length} Kandidat:in(nen) im Interview`,
      detail: "Feedback einholen und Entscheidung beschleunigen",
      action: "Status nachhalten, Angebot vorbereiten",
      href: "/cockpit/kandidaten",
      line: "recruiting",
      value: 0,
      urgency: 90,
    });
  }
  // Aktive Kandidat:innen ohne Update (>14 T) – Prozess am Laufen halten.
  const staleCandidates = candidates.filter((c) => {
    if (c.stage === "platziert" || c.stage === "abgelehnt" || c.stage === "neu") return false;
    const d = c.updated_at ? -(daysUntil(c.updated_at) ?? 0) : null;
    return d != null && d >= 14;
  }).length;
  if (staleCandidates >= 2) {
    push({
      id: "cand-stale",
      severity: "wichtig",
      category: "Kandidaten",
      title: `${staleCandidates} Kandidat:in(nen) ohne Update >14 T`,
      detail: "Prozess stockt – Status nachhalten, sonst springen sie ab",
      action: "Nachfassen und nächsten Schritt setzen",
      href: "/cockpit/kandidaten",
      line: "recruiting",
      value: 0,
      urgency: 75,
    });
  }
  const toScreen = candidates.filter((c) => c.stage === "neu").length;
  if (toScreen >= 3) {
    push({
      id: "cand-screen",
      severity: "chance",
      category: "Kandidaten",
      title: `${toScreen} neue Kandidat:innen zu sichten`,
      detail: "Schnelles Screening hält die Pipeline warm",
      action: "Screening durchführen und einordnen",
      href: "/cockpit/kandidaten",
      line: "recruiting",
      value: 0,
      urgency: 30,
    });
  }

  // 6b) Inaktive Bestandskunden reaktivieren (≥45 T ohne Aktivität).
  const inactive = accounts
    .filter((a) => (a.lifecycle === "kunde" || a.lifecycle === "bestand") && !a.synthetic)
    .map((a) => ({ a, d: a.last_activity_at ? -(daysUntil(a.last_activity_at) ?? 0) : null }))
    .filter((x) => x.d != null && x.d >= 45)
    .sort((x, y) => (y.a.mrr - x.a.mrr) || ((y.d ?? 0) - (x.d ?? 0)))
    .slice(0, 2);
  for (const { a, d } of inactive) {
    push({
      id: `react-${a.id}`,
      severity: a.mrr > 0 ? "wichtig" : "chance",
      category: "Kunde",
      title: `${a.name} – seit ${d} T still`,
      detail: a.mrr > 0 ? `${formatMrr(a.mrr)} Bestand ohne Kontakt` : "Bestandskunde ohne Kontakt",
      action: "Reaktivieren: kurzes Check-in, Mehrwert/Upsell prüfen",
      href: `/cockpit/kunden/${a.id}`,
      line: a.line,
      value: a.mrr * 12,
      urgency: a.mrr > 0 ? 70 : 25,
    });
  }

  // 7) Kalte Leads ohne Projekt – Reaktivierung als Chance.
  const leadAccounts = accounts.filter((a) => a.lifecycle === "lead");
  if (leadAccounts.length > 0) {
    push({
      id: "leads-cold",
      severity: "chance",
      category: "Akquise",
      title: `${leadAccounts.length} Lead(s) ohne Abschluss`,
      detail: "Warm halten: Erstkontakt oder Follow-up",
      action: "Top-Leads kontaktieren (Kaltakquise-Ziel)",
      href: "/cockpit/leads",
      value: 0,
      urgency: 20,
    });
  }

  signals.sort((a, b) => b.score - a.score);
  const top = signals.slice(0, 8);

  const counts = {
    kritisch: signals.filter((s) => s.severity === "kritisch").length,
    wichtig: signals.filter((s) => s.severity === "wichtig").length,
    chance: signals.filter((s) => s.severity === "chance").length,
  };
  const atRisk =
    opps
      .filter((o) => {
        const d = daysUntil(o.expected_close);
        return o.stage !== "gewonnen" && o.stage !== "verloren" && d != null && d <= 21;
      })
      .reduce((s, o) => s + (o.value_type === "mrr" ? o.value * 12 : o.value), 0) +
    invoices.overdue +
    ki
      .filter((p) => p.status !== "gekuendigt" && (p.churn_risk === "hoch" || (daysUntil(p.contract_end) ?? 999) <= 60))
      .reduce((s, p) => s + p.mrr * 12, 0);

  return { signals: top, generatedAt: new Date().toISOString(), counts, atRisk };
}

function formatMrr(v: number): string {
  return `${formatEurShort(v)}/M`;
}
function formatEurShort(v: number): string {
  return new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(v || 0);
}
