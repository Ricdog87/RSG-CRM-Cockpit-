import "server-only";
import { aiConfigured } from "@/lib/ai/config";
import { llmComplete } from "@/lib/ai/llm";

/**
 * Wochen-Review (Freitag = Review-Tag): fasst die Woche zusammen und gibt einen
 * Fokus für die nächste Woche. Kandidaten-DB-Sicht: Kandidaten, Einwilligungen,
 * Vorstellungen. Deterministischer Fallback ohne KI-Provider.
 */
export interface WeeklyReviewInput {
  calls: number;
  emails: number;
  kiActivities: number;
  recruitingActivities: number;
  /** Neu erfasste Kandidat:innen diese Woche. */
  newCandidates: number;
  /** Erteilte DSGVO-Einwilligungen diese Woche. */
  consentsGranted: number;
  /** Neue Matches/Vorstellungen (Kandidat ↔ HubSpot-Projekt) diese Woche. */
  presentations: number;
  atRisk: number;
  kritisch: number;
  wichtig: number;
}

const SYSTEM = `Du bist Recruiting-Coach bei RSG. Das CRM ist eine Kandidaten-Datenbank mit Datenschutz-Fokus; Projekte/Kunden leben in HubSpot. Heute ist Freitag (Review-Tag, Mo–Do wird aktiv rekrutiert).
Schreibe ein kurzes Wochen-Review auf Deutsch (Du-Form): 3–5 Sätze. Würdige Erreichtes mit Zahlen (Kandidaten, Einwilligungen, Vorstellungen), benenne das größte Risiko, und gib EINEN klaren Fokus für nächste Woche.
Konkret, motivierend, keine erfundenen Fakten – nur die gelieferten Zahlen.`;

function eur(v: number): string {
  return new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(v || 0);
}

export function heuristicWeeklyReview(i: WeeklyReviewInput): string {
  const parts: string[] = [];
  parts.push(
    `Diese Woche: ${i.calls} Calls, ${i.emails} E-Mails, ${i.newCandidates} neue Kandidat:innen, ${i.consentsGranted} erteilte Einwilligungen${i.presentations > 0 ? `, ${i.presentations} Vorstellung(en)` : ""}.`
  );
  if (i.atRisk > 0) parts.push(`Im Blick fürs Wochenende der Planung: ${eur(i.atRisk)} stehen auf dem Spiel (${i.kritisch} kritisch).`);
  parts.push(
    i.newCandidates + i.consentsGranted > 0
      ? "Solide Pipeline-Arbeit – nächste Woche dranbleiben und vorstellbare Kandidat:innen aktiv matchen."
      : "Nächste Woche Fokus auf die Datenbank: neue Kandidat:innen erfassen und Einwilligungen einholen."
  );
  return parts.join(" ");
}

export async function narrateWeeklyReview(i: WeeklyReviewInput): Promise<{ text: string; mode: "live" | "demo" }> {
  if (!aiConfigured) return { text: heuristicWeeklyReview(i), mode: "demo" };
  try {
    const user = `Wochenzahlen:
- Calls: ${i.calls}, E-Mails: ${i.emails}
- Aktivitäten KI/Recruiting: ${i.kiActivities}/${i.recruitingActivities}
- Neue Kandidat:innen: ${i.newCandidates}, Erteilte Einwilligungen: ${i.consentsGranted}, Vorstellungen: ${i.presentations}
- Auf dem Spiel: ${eur(i.atRisk)} (kritisch: ${i.kritisch}, wichtig: ${i.wichtig})

Schreibe das Wochen-Review.`;
    const text = await llmComplete(SYSTEM, user);
    return { text: text.trim() || heuristicWeeklyReview(i), mode: "live" };
  } catch {
    return { text: heuristicWeeklyReview(i), mode: "demo" };
  }
}
