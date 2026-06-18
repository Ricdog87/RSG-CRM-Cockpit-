import type { Candidate } from "@/lib/crm-types";

/**
 * Deterministische Kandidaten-Intelligenz: nächste beste Aktion je nach Phase
 * und Aktualität. Vervollständigt die Intelligenz über alle Kern-Entitäten.
 */
export type CandidateIntelTone = "success" | "sky" | "warning" | "danger";

export interface CandidateIntel {
  recommendation: string;
  tone: CandidateIntelTone;
  label: string;
  stale: boolean;
}

export function computeCandidateIntel(c: Candidate): CandidateIntel {
  const daysSince = c.updated_at
    ? Math.floor((Date.now() - new Date(c.updated_at).getTime()) / 86400000)
    : null;
  const active = c.stage !== "platziert" && c.stage !== "abgelehnt";
  const stale = active && daysSince != null && daysSince >= 14;

  let recommendation: string;
  let tone: CandidateIntelTone = "sky";
  let label = "Aktiv";

  switch (c.stage) {
    case "neu":
      recommendation = "Screening: Profil sichten, Skills/Verfügbarkeit prüfen und passendem Mandat zuordnen.";
      label = "Neu";
      tone = "sky";
      break;
    case "screening":
      recommendation = "Erstgespräch führen, Eignung bewerten und – wenn passend – beim Kunden vorstellen.";
      label = "Screening";
      tone = "sky";
      break;
    case "interview":
      recommendation = "Interview-Feedback einholen und Entscheidung beim Kunden aktiv treiben.";
      label = "Interview";
      tone = "warning";
      break;
    case "angebot":
      recommendation = "Angebot nachfassen, Vertragsdetails klären und Zusage sichern.";
      label = "Angebot";
      tone = "warning";
      break;
    case "platziert":
      recommendation = "Aftercare: Onboarding begleiten, Garantiezeit & NPS im Blick behalten.";
      label = "Platziert";
      tone = "success";
      break;
    case "abgelehnt":
      recommendation = "In den Talent-Pool aufnehmen und für künftige Mandate vormerken (Silver Medalist).";
      label = "Talent-Pool";
      tone = "success";
      break;
    default:
      recommendation = "Nächsten Schritt setzen und Status aktuell halten.";
  }

  if (stale) {
    recommendation = `Seit ${daysSince} T ohne Update – jetzt nachfassen, bevor der/die Kandidat:in abspringt. ${recommendation}`;
    tone = "danger";
    label = "Nachfassen";
  }

  return { recommendation, tone, label, stale };
}
