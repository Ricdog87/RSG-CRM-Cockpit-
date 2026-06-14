import "server-only";
import { AI, aiConfigured } from "@/lib/ai/config";
import { llmComplete, extractJson } from "@/lib/ai/llm";
import { webResearch } from "@/lib/ai/research";
import type {
  Confidence,
  LeadAnalysis,
  LeadInput,
  LeadResult,
  RecommendedLine,
} from "@/lib/ai/types";

// RSG-Kontext für das Modell: zwei Geschäftslinien, Produkte, Ideal-Kundenprofil.
const SYSTEM = `Du bist der Lead-Intelligence-Analyst von RSG (Recruiting Solutions Group).
RSG verkauft an KMU im DACH-Raum über ZWEI Linien:
1) RSG AI – KI & Automatisierung (Produkte: Automatische Workflows 1.497€ Setup / 297€/M, Autonome KI-Agenten 4.997€ Setup / 497€/M, Voice-Agenten (RSG Voice Suite) Custom Setup / ab 797€/M, candiq 99€/M). Ideal: Betriebe mit hohem Anrufaufkommen, verpassten Anrufen, Termindruck, dünner Erreichbarkeit, manuellen Routineprozessen (Handwerk, Gesundheit/Praxen, Kanzleien, Gastro, Autohäuser, lokale Dienstleister).
2) RSG Recruiting – Personalvermittlung zum Festpreis (9.999€ je Besetzung). Ideal: Unternehmen mit offenen, schwer zu besetzenden Stellen / Fachkräftemangel.

Deine Aufgabe: Ein Unternehmen als potenziellen RSG-Kunden bewerten – nüchtern, B2B, ohne Floskeln.
Bewerte die Eignung (fit_score 0–100), empfiehl die passende Linie, nenne konkrete Kaufsignale, vermutete Schmerzpunkte, Gesprächsaufhänger und einen kurzen, personalisierten Erstkontakt-Text (deutsch, max. 90 Wörter, kein Marketing-Geschwurbel).
Wenn die Faktenlage dünn ist, setze confidence niedriger und sei explizit über Annahmen.
Antworte AUSSCHLIESSLICH mit einem JSON-Objekt in genau diesem Schema (keine weiteren Felder, kein Text drumherum):
{
  "company": string,
  "industry": string,
  "size_estimate": string,
  "location": string,
  "summary": string,
  "fit_score": number (0-100),
  "recommended_line": "ki" | "recruiting" | "beide" | "keine",
  "signals": string[],
  "pain_points": string[],
  "talking_points": string[],
  "outreach_email": string,
  "confidence": "hoch" | "mittel" | "niedrig"
}`;

function buildUserPrompt(input: LeadInput, research: string | null): string {
  const parts = [`Unternehmen: ${input.company}`];
  if (input.domain) parts.push(`Website/Domain: ${input.domain}`);
  if (input.notes) parts.push(`Notizen des Partners: ${input.notes}`);
  if (research) {
    parts.push(`\nAktuelle Web-Recherche (Perplexity):\n${research}`);
  } else {
    parts.push(
      "\nKeine Web-Recherche verfügbar – arbeite mit Branchenwissen und kennzeichne Annahmen."
    );
  }
  parts.push("\nLiefere die Analyse als JSON gemäß Schema.");
  return parts.join("\n");
}

const LINES: RecommendedLine[] = ["ki", "recruiting", "beide", "keine"];
const CONF: Confidence[] = ["hoch", "mittel", "niedrig"];

/** Defensive Normalisierung der Modellantwort auf das Schema. */
function normalize(raw: Partial<LeadAnalysis>, input: LeadInput): LeadAnalysis {
  const arr = (v: unknown): string[] =>
    Array.isArray(v) ? v.map(String).filter(Boolean).slice(0, 8) : [];
  const score = Math.max(0, Math.min(100, Math.round(Number(raw.fit_score) || 0)));
  return {
    company: String(raw.company || input.company),
    industry: String(raw.industry || "—"),
    size_estimate: String(raw.size_estimate || "—"),
    location: String(raw.location || "—"),
    summary: String(raw.summary || ""),
    fit_score: score,
    recommended_line: LINES.includes(raw.recommended_line as RecommendedLine)
      ? (raw.recommended_line as RecommendedLine)
      : "ki",
    signals: arr(raw.signals),
    pain_points: arr(raw.pain_points),
    talking_points: arr(raw.talking_points),
    outreach_email: String(raw.outreach_email || ""),
    confidence: CONF.includes(raw.confidence as Confidence)
      ? (raw.confidence as Confidence)
      : "mittel",
  };
}

/** Analysiert einen Lead. Ohne API-Key → realistische Demo-Analyse. */
export async function analyzeLead(input: LeadInput): Promise<LeadResult> {
  if (!aiConfigured) {
    return { analysis: demoAnalysis(input), mode: "demo", grounded: false, model: "demo" };
  }

  const research = await webResearch(
    `${input.company}${input.domain ? ` (${input.domain})` : ""} – Branche, Größe, Standort, aktuelle Signale (Wachstum, offene Stellen, Erreichbarkeit/Telefon).`
  );

  const raw = await llmComplete(SYSTEM, buildUserPrompt(input, research));
  const parsed = extractJson<Partial<LeadAnalysis>>(raw);

  return {
    analysis: normalize(parsed, input),
    mode: "live",
    grounded: research != null,
    model: AI.model,
  };
}

/** Deterministische Demo-Analyse für die Preview ohne API-Key. */
export function demoAnalysis(input: LeadInput): LeadAnalysis {
  const name = input.company || "Beispiel GmbH";
  return {
    company: name,
    industry: "Handwerk / lokale Dienstleistung",
    size_estimate: "10–50 Mitarbeitende",
    location: "DACH-Raum",
    summary: `${name} ist ein typischer KMU-Betrieb mit hohem telefonischem Kundenkontakt und vermutlich Engpässen bei Erreichbarkeit und Fachkräften – ein guter Doppel-Ansatz für RSG.`,
    fit_score: 78,
    recommended_line: "beide",
    signals: [
      "Hohes Anrufaufkommen, Erreichbarkeit außerhalb der Kernzeiten unklar",
      "Wachstum sichtbar (mehrere Standorte / Stellenanzeigen)",
      "Manuelle Terminvergabe per Telefon",
    ],
    pain_points: [
      "Verpasste Anrufe = verlorene Aufträge",
      "Offene Stellen bleiben lange unbesetzt",
      "Team durch Telefon vom Kerngeschäft abgelenkt",
    ],
    talking_points: [
      "Autonome KI-Agenten nehmen verpasste Anrufe an und qualifizieren vor",
      "Recruiting zum Festpreis statt teurer Personalberatung",
      "Schneller Pilot mit messbarer Anrufannahme-Quote",
    ],
    outreach_email: `Hallo zusammen,\n\nmir ist aufgefallen, dass bei ${name} viel über Telefon läuft – genau da verlieren Betriebe oft Aufträge durch verpasste Anrufe. Wir von RSG schalten eine KI-Telefonassistenz, die rund um die Uhr annimmt, qualifiziert und Termine setzt. Falls Personal ein Thema ist: wir besetzen offene Stellen zum Festpreis.\n\nHätten Sie diese Woche 15 Minuten für einen kurzen Pilot-Vorschlag?\n\nBeste Grüße`,
    confidence: "mittel",
  };
}
