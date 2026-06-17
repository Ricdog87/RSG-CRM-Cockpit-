import "server-only";
import { aiConfigured } from "@/lib/ai/config";
import { llmComplete } from "@/lib/ai/llm";

/**
 * Wochen-Review (Freitag = Review-Tag): fasst die Woche zusammen und gibt einen
 * Fokus für die nächste Woche. Deterministischer Fallback ohne KI-Provider.
 */
export interface WeeklyReviewInput {
  calls: number;
  emails: number;
  kiActivities: number;
  recruitingActivities: number;
  newMandates: number;
  newKi: number;
  placements: number;
  atRisk: number;
  kritisch: number;
  wichtig: number;
}

const SYSTEM = `Du bist Sales-Coach bei RSG (RSG Recruiting + RSG AI). Heute ist Freitag (Review-Tag, Mo–Do wird akquiriert).
Schreibe ein kurzes Wochen-Review auf Deutsch (Du-Form): 3–5 Sätze. Würdige Erreichtes mit Zahlen, benenne das größte Risiko, und gib EINEN klaren Fokus für nächste Woche.
Konkret, motivierend, keine erfundenen Fakten – nur die gelieferten Zahlen.`;

function eur(v: number): string {
  return new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(v || 0);
}

export function heuristicWeeklyReview(i: WeeklyReviewInput): string {
  const parts: string[] = [];
  parts.push(
    `Diese Woche: ${i.calls} Calls, ${i.emails} E-Mails, ${i.newMandates} neue Mandate, ${i.newKi} neue KI-Projekte${i.placements > 0 ? `, ${i.placements} Platzierung(en)` : ""}.`
  );
  if (i.atRisk > 0) parts.push(`Im Blick fürs Wochenende der Planung: ${eur(i.atRisk)} stehen auf dem Spiel (${i.kritisch} kritisch).`);
  parts.push(
    i.newMandates + i.newKi > 0
      ? "Solide Akquise – nächste Woche dranbleiben und die offenen Abschlüsse priorisieren."
      : "Nächste Woche Fokus auf neue Projekte: Kaltakquise-Ziele konsequent abarbeiten."
  );
  return parts.join(" ");
}

export async function narrateWeeklyReview(i: WeeklyReviewInput): Promise<{ text: string; mode: "live" | "demo" }> {
  if (!aiConfigured) return { text: heuristicWeeklyReview(i), mode: "demo" };
  try {
    const user = `Wochenzahlen:
- Calls: ${i.calls}, E-Mails: ${i.emails}
- Aktivitäten KI/Recruiting: ${i.kiActivities}/${i.recruitingActivities}
- Neue Mandate: ${i.newMandates}, Neue KI-Projekte: ${i.newKi}, Platzierungen: ${i.placements}
- Auf dem Spiel: ${eur(i.atRisk)} (kritisch: ${i.kritisch}, wichtig: ${i.wichtig})

Schreibe das Wochen-Review.`;
    const text = await llmComplete(SYSTEM, user);
    return { text: text.trim() || heuristicWeeklyReview(i), mode: "live" };
  } catch {
    return { text: heuristicWeeklyReview(i), mode: "demo" };
  }
}
