import type {
  Account,
  Opportunity,
  KiProject,
  RecruitingMandate,
  Candidate,
} from "@/lib/crm-types";

/**
 * Deterministische Account-Intelligence: berechnet einen Health-Score (0–100),
 * die wichtigsten Einflussfaktoren und die nächste beste Aktion pro Kunde.
 * Läuft ohne KI-Provider – grundlegende Vertriebslogik, HubSpot-inspiriert.
 */
export type IntelTone = "success" | "sky" | "warning" | "danger";

export interface AccountIntel {
  score: number;
  label: string;
  tone: IntelTone;
  factors: { label: string; positive: boolean }[];
  nextAction: string;
  /** Tage seit letzter Aktivität (null = unbekannt) */
  daysSinceActivity: number | null;
}

export interface AccountIntelInput {
  account: Account;
  opportunities: Opportunity[];
  kiProjects: KiProject[];
  mandates: RecruitingMandate[];
  candidates: Candidate[];
  /** ISO-Zeitstempel relevanter Aktivität (E-Mails, Notizen, Aufgaben). */
  activityDates?: (string | undefined | null)[];
}

const DAY = 86400000;

function daysAgo(iso?: string | null): number | null {
  if (!iso) return null;
  const t = new Date(iso.length <= 10 ? iso + "T00:00:00" : iso).getTime();
  if (Number.isNaN(t)) return null;
  return Math.floor((Date.now() - t) / DAY);
}

function daysUntil(iso?: string | null): number | null {
  const a = daysAgo(iso);
  return a == null ? null : -a;
}

export function computeAccountIntel(input: AccountIntelInput): AccountIntel {
  const { account, opportunities, kiProjects, mandates, candidates } = input;
  const factors: { label: string; positive: boolean }[] = [];
  let score = 50;

  // Letzte Aktivität (Recency) – stärkster Einzelfaktor.
  const allDates = [account.last_activity_at, ...(input.activityDates ?? [])];
  const recency = allDates
    .map((d) => daysAgo(d))
    .filter((n): n is number => n != null)
    .sort((a, b) => a - b)[0];
  const daysSinceActivity = recency ?? null;
  if (recency == null) {
    score -= 8;
    factors.push({ label: "Keine getrackte Aktivität", positive: false });
  } else if (recency <= 14) {
    score += 16;
    factors.push({ label: `Aktiv (vor ${recency} T kontaktiert)`, positive: true });
  } else if (recency <= 45) {
    score += 4;
    factors.push({ label: `Kontakt vor ${recency} T`, positive: true });
  } else if (recency <= 90) {
    score -= 8;
    factors.push({ label: `Länger still (${recency} T)`, positive: false });
  } else {
    score -= 18;
    factors.push({ label: `Inaktiv seit ${recency} T`, positive: false });
  }

  // Lifecycle / Bindung.
  if (account.lifecycle === "kunde" || account.lifecycle === "bestand") {
    score += 12;
    factors.push({ label: "Aktiver Kunde", positive: true });
  } else if (account.lifecycle === "lead") {
    score -= 4;
    factors.push({ label: "Noch Lead (nicht gewonnen)", positive: false });
  }

  // Wiederkehrender Umsatz (KI) & laufende Projekte.
  const liveKi = kiProjects.filter((p) => p.status !== "gekuendigt" && p.status !== "angebot");
  const mrr = liveKi.reduce((s, p) => s + p.mrr, 0);
  if (mrr > 0) {
    score += 10;
    factors.push({ label: `${formatEur(mrr)}/M wiederkehrend`, positive: true });
  }

  // Churn-/Health-Risiko (KI).
  const churnHigh = kiProjects.some((p) => p.status !== "gekuendigt" && p.churn_risk === "hoch");
  const risiko = kiProjects.some((p) => p.status !== "gekuendigt" && p.health === "risiko");
  const gut = liveKi.length > 0 && liveKi.every((p) => p.health === "gut");
  if (churnHigh) {
    score -= 22;
    factors.push({ label: "Churn-Risiko hoch", positive: false });
  } else if (risiko) {
    score -= 12;
    factors.push({ label: "Health „Risiko“", positive: false });
  } else if (gut) {
    score += 6;
    factors.push({ label: "Health durchweg gut", positive: true });
  }

  // Renewal-Fenster.
  const renewalSoon = kiProjects.some((p) => {
    if (p.status === "gekuendigt") return false;
    const d = daysUntil(p.contract_end);
    return d != null && d <= 30;
  });
  if (renewalSoon) {
    score -= 8;
    factors.push({ label: "Verlängerung steht an", positive: false });
  }

  // Offene Verkaufschancen.
  const openOpps = opportunities.filter((o) => o.stage !== "gewonnen" && o.stage !== "verloren");
  if (openOpps.length > 0) {
    score += 6;
    factors.push({ label: `${openOpps.length} offene Chance(n)`, positive: true });
  }

  // Recruiting-Mandate: Fortschritt vs. überfällig.
  const openMandates = mandates.filter((m) => m.status !== "besetzt" && m.status !== "angebot");
  const overdueMandate = openMandates.some((m) => {
    const d = daysUntil(m.deadline);
    return d != null && d < 0 && m.filled < m.positions;
  });
  if (overdueMandate) {
    score -= 8;
    factors.push({ label: "Mandat über Deadline", positive: false });
  } else if (openMandates.length > 0) {
    factors.push({ label: `${openMandates.length} laufende(s) Mandat(e)`, positive: true });
  }

  // Erfolgreiche Platzierungen / Vertragsstatus.
  const placed = candidates.filter((c) => c.stage === "platziert").length;
  if (placed > 0) {
    score += 8;
    factors.push({ label: `${placed} Platzierung(en)`, positive: true });
  }
  if (account.contract_status === "unterzeichnet") {
    score += 6;
    factors.push({ label: "Vertrag unterzeichnet", positive: true });
  }

  score = Math.max(0, Math.min(100, Math.round(score)));

  let label = "Beobachten";
  let tone: IntelTone = "warning";
  if (score >= 75) {
    label = "Top-Beziehung";
    tone = "success";
  } else if (score >= 55) {
    label = "Gesund";
    tone = "sky";
  } else if (score >= 35) {
    label = "Beobachten";
    tone = "warning";
  } else {
    label = "Gefährdet";
    tone = "danger";
  }

  // Nächste beste Aktion – nach dominanter Dringlichkeit.
  let nextAction: string;
  if (churnHigh || risiko) {
    nextAction = "Erfolgs-Call vereinbaren: Mehrwert zeigen, Churn abwenden.";
  } else if (renewalSoon) {
    nextAction = "Vertragsverlängerung proaktiv anstoßen.";
  } else if (overdueMandate) {
    nextAction = "Kandidat:innen vorstellen – Mandat ist über Deadline.";
  } else if (recency != null && recency > 60) {
    nextAction = "Reaktivieren: persönlich melden und Status abfragen.";
  } else if (openOpps.length > 0) {
    nextAction = "Offene Chance vorantreiben und Abschluss terminieren.";
  } else if (account.lifecycle === "lead") {
    nextAction = "Erstkontakt/Qualifizierung – Bedarf konkretisieren.";
  } else if (openMandates.length > 0) {
    nextAction = "Sourcing & Interviews takten, Pipeline füllen.";
  } else {
    nextAction = "Beziehung pflegen und Upsell-Potenzial prüfen.";
  }

  return { score, label, tone, factors: factors.slice(0, 6), nextAction, daysSinceActivity };
}

function formatEur(v: number): string {
  return new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(v || 0);
}
