import type { RecruitingMandate } from "@/lib/crm-types";

/**
 * Deterministische Mandats-Intelligenz: leitet aus Status, Besetzungs-
 * fortschritt, Deadline und Kandidaten-Pipeline die nächste beste Aktion ab.
 * Vervollständigt die Trilogie Account- / KI-Projekt- / Mandats-Intelligenz.
 */
export type MandateIntelTone = "success" | "sky" | "warning" | "danger";

export interface MandateIntel {
  recommendation: string;
  tone: MandateIntelTone;
  label: string;
  factors: { label: string; positive: boolean }[];
  deadlineInDays: number | null;
}

function daysUntil(iso?: string): number | null {
  if (!iso) return null;
  const t = new Date(iso.length <= 10 ? iso + "T00:00:00" : iso).getTime();
  if (Number.isNaN(t)) return null;
  return Math.round((t - Date.now()) / 86400000);
}

export function computeMandateIntel(m: RecruitingMandate, candidateCount: number): MandateIntel {
  const factors: { label: string; positive: boolean }[] = [];
  const open = Math.max(0, m.positions - m.filled);
  const deadlineInDays = daysUntil(m.deadline);
  const fewCandidates = candidateCount < 3;

  factors.push({ label: `${m.filled}/${m.positions} besetzt`, positive: m.filled > 0 });
  factors.push({ label: `${candidateCount} Kandidat:innen`, positive: !fewCandidates });
  if (deadlineInDays != null)
    factors.push({
      label: deadlineInDays < 0 ? `${Math.abs(deadlineInDays)} T überfällig` : `Deadline in ${deadlineInDays} T`,
      positive: deadlineInDays >= 14,
    });

  let recommendation: string;
  let tone: MandateIntelTone = "sky";
  let label = "In Arbeit";

  if (m.status === "besetzt" || open <= 0) {
    recommendation = "Besetzt – Honorar-Rechnung stellen und Garantie/Aftercare im Blick behalten.";
    tone = "success";
    label = "Besetzt";
  } else if (m.status === "angebot") {
    recommendation = "Angebot nachfassen: Mandat gewinnen, Vertrag/AGB & Honorar klären.";
    tone = "sky";
    label = "Im Angebot";
  } else if (m.status === "pausiert") {
    recommendation = "Pausiert – Status mit Kunde klären: reaktivieren oder sauber schließen.";
    tone = "warning";
    label = "Pausiert";
  } else if (deadlineInDays != null && deadlineInDays < 0) {
    recommendation = "Über Deadline: Kunde proaktiv updaten, Sourcing-Tempo erhöhen, Erwartungen steuern.";
    tone = "danger";
    label = "Über Deadline";
  } else if (fewCandidates) {
    recommendation = "Pipeline dünn: aktiv sourcen, Talent-Pool & Search-Match nutzen, Kandidat:innen ansprechen.";
    tone = "warning";
    label = "Pipeline dünn";
  } else if (m.status === "interviews") {
    recommendation = "Interviews laufen: Feedback einholen, Entscheidung treiben, Angebot vorbereiten.";
    tone = "sky";
    label = "Interviews";
  } else if (m.filled > 0) {
    recommendation = "Teilbesetzt: restliche Stellen besetzen – Tempo halten, beste Profile nachschieben.";
    tone = "sky";
    label = "Teilbesetzt";
  } else {
    recommendation = "Kandidat:innen vorstellen und Interviews takten – Pipeline ist gefüllt.";
    tone = "success";
    label = "Auf Kurs";
  }

  return { recommendation, tone, label, factors: factors.slice(0, 6), deadlineInDays };
}
