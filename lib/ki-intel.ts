import type { KiProject } from "@/lib/crm-types";

/**
 * Deterministische KI-Projekt-Intelligenz: leitet aus Status, Health,
 * Churn-Risiko, Vertragslaufzeit, NPS und Upsell-Potenzial die nächste beste
 * Aktion ab. Läuft ohne KI-Provider – Kern-Logik für die KI-Berater:innen.
 */
export type KiIntelTone = "success" | "sky" | "warning" | "danger";

export interface KiProjectIntel {
  recommendation: string;
  tone: KiIntelTone;
  label: string;
  factors: { label: string; positive: boolean }[];
  /** Tage bis Vertragsende (negativ = überfällig, null = unbekannt) */
  renewalInDays: number | null;
}

function daysUntil(iso?: string): number | null {
  if (!iso) return null;
  const t = new Date(iso.length <= 10 ? iso + "T00:00:00" : iso).getTime();
  if (Number.isNaN(t)) return null;
  return Math.round((t - Date.now()) / 86400000);
}

export function computeKiProjectIntel(p: KiProject): KiProjectIntel {
  const factors: { label: string; positive: boolean }[] = [];
  const renewalInDays = daysUntil(p.contract_end);
  const churnHigh = p.churn_risk === "hoch";
  const risiko = p.health === "risiko";

  if (p.health === "gut") factors.push({ label: "Health gut", positive: true });
  if (risiko) factors.push({ label: "Health Risiko", positive: false });
  if (churnHigh) factors.push({ label: "Churn-Risiko hoch", positive: false });
  if (p.mrr > 0) factors.push({ label: `${formatEur(p.mrr)}/M`, positive: true });
  if (renewalInDays != null && renewalInDays <= 60)
    factors.push({ label: renewalInDays < 0 ? `Vertrag ${Math.abs(renewalInDays)} T überfällig` : `Verlängerung in ${renewalInDays} T`, positive: false });
  if (p.nps != null) factors.push({ label: `NPS ${p.nps}`, positive: p.nps >= 9 });
  if (p.auto_renew) factors.push({ label: "Auto-Renew aktiv", positive: true });

  let recommendation: string;
  let tone: KiIntelTone = "sky";
  let label = "Stabil";

  if (p.status === "gekuendigt") {
    recommendation = "Gekündigt – Win-Back planen: Abschlussgespräch führen und Reaktivierung in 60–90 Tagen terminieren.";
    tone = "danger";
    label = "Gekündigt";
  } else if (churnHigh || risiko) {
    recommendation = "Erfolgs-Call vereinbaren: Nutzen mit Zahlen belegen, Eskalationen klären, Churn abwenden.";
    tone = "danger";
    label = "Gefährdet";
  } else if (renewalInDays != null && renewalInDays <= 60 && !p.auto_renew) {
    recommendation = `Vertragsverlängerung jetzt anstoßen – läuft ${renewalInDays < 0 ? `seit ${Math.abs(renewalInDays)} T ab` : `in ${renewalInDays} T aus`}.`;
    tone = "warning";
    label = "Renewal fällig";
  } else if (p.status === "angebot") {
    recommendation = "Angebot nachfassen und Entscheidung einholen – konkreten Go-Live-Termin vorschlagen.";
    tone = "sky";
    label = "Im Angebot";
  } else if (p.status === "onboarding") {
    recommendation = "Onboarding vorantreiben: Readiness-Checkliste abschließen und Go-Live-Termin fix machen.";
    tone = "sky";
    label = "Onboarding";
  } else if (p.nps != null && p.nps <= 6) {
    recommendation = "Detraktor (NPS niedrig): Feedback einholen, Maßnahmenplan ableiten und nachfassen.";
    tone = "warning";
    label = "NPS niedrig";
  } else if (p.upsell_potential) {
    recommendation = `Upsell-Chance prüfen: ${p.upsell_potential}${p.upsell_value ? ` (${formatEur(p.upsell_value)})` : ""}.`;
    tone = "success";
    label = "Upsell";
  } else {
    recommendation = "Stabil – Referenz/Case-Study anfragen, NPS abfragen und Upsell-Potenzial sondieren.";
    tone = "success";
    label = "Stabil";
  }

  return { recommendation, tone, label, factors: factors.slice(0, 6), renewalInDays };
}

function formatEur(v: number): string {
  return new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(v || 0);
}
