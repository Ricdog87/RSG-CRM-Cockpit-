import "server-only";
import { aiConfigured } from "@/lib/ai/config";
import { llmComplete, extractJson } from "@/lib/ai/llm";
import { webResearch } from "@/lib/ai/research";
import type {
  DiscoveryCriteria,
  DiscoveryResult,
  LeadCandidate,
  RecommendedLine,
} from "@/lib/ai/types";

const SYSTEM = `Du bist der Lead-Discovery-Analyst von RSG (KI-Telefonassistenz "RSG AI" + Personalvermittlung zum Festpreis "RSG Recruiting").
Ideale Ziele: KMU im DACH-Raum mit hohem telefonischem Kundenkontakt / verpassten Anrufen (für RSG AI) und/oder offenen, schwer besetzbaren Stellen (für RSG Recruiting) – Handwerk, Gesundheit/Praxen, Kanzleien, Gastro, Autohäuser, lokale Dienstleister.
Schlage konkrete Ziel-Unternehmen vor, die zum vorgegebenen Idealprofil passen.
WICHTIG: Wenn Web-Recherche vorliegt, nutze AUSSCHLIESSLICH dort genannte, reale Unternehmen. Liegt keine Recherche vor, kennzeichne, dass es illustrative Profile sind, und bleibe bei plausiblen Typen statt erfundener Eigennamen.
Antworte AUSSCHLIESSLICH mit JSON in diesem Schema (max. 8 Kandidaten, keine weiteren Felder):
{ "candidates": [ { "company": string, "location": string, "industry": string, "why_fit": string, "recommended_line": "ki" | "recruiting" | "beide" | "keine", "fit_score": number (0-100) } ] }`;

const LINES: RecommendedLine[] = ["ki", "recruiting", "beide", "keine"];

function criteriaText(c: DiscoveryCriteria): string {
  const focus =
    c.focus === "ki"
      ? "Fokus RSG AI (Telefonassistenz)"
      : c.focus === "recruiting"
        ? "Fokus RSG Recruiting"
        : "beide Linien";
  return [
    c.branche ? `Branche: ${c.branche}` : "Branche: offen",
    c.region ? `Region: ${c.region}` : "Region: DACH",
    c.size ? `Größe: ${c.size}` : "Größe: KMU",
    focus,
    c.notes ? `Zusatz: ${c.notes}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

function normalize(raw: Partial<LeadCandidate>): LeadCandidate {
  const score = Math.max(0, Math.min(100, Math.round(Number(raw.fit_score) || 0)));
  return {
    company: String(raw.company || "Unbenannt"),
    location: String(raw.location || "—"),
    industry: String(raw.industry || "—"),
    why_fit: String(raw.why_fit || ""),
    recommended_line: LINES.includes(raw.recommended_line as RecommendedLine)
      ? (raw.recommended_line as RecommendedLine)
      : "ki",
    fit_score: score,
  };
}

/** Findet passende Ziel-Accounts zum Idealprofil. Ohne API-Key → Demo. */
export async function discoverLeads(
  criteria: DiscoveryCriteria
): Promise<DiscoveryResult> {
  if (!aiConfigured) {
    return { candidates: demoCandidates(criteria), mode: "demo", grounded: false };
  }

  const research = await webResearch(
    `Nenne konkrete, reale ${criteria.branche || "KMU"}-Unternehmen in ${criteria.region || "DACH"} (${criteria.size || "KMU"}) mit hohem Telefonaufkommen oder offenen Stellen. Mit Name, Standort und kurzer Begründung.`
  );

  const user = `Idealprofil:\n${criteriaText(criteria)}\n\n${
    research
      ? `Web-Recherche:\n${research}`
      : "Keine Web-Recherche verfügbar – illustrative Profile, klar gekennzeichnet."
  }\n\nGib JSON gemäß Schema zurück.`;

  try {
    const raw = await llmComplete(SYSTEM, user);
    const parsed = extractJson<{ candidates?: Partial<LeadCandidate>[] }>(raw);
    const candidates = (parsed.candidates ?? []).slice(0, 8).map(normalize);
    return {
      candidates: candidates.length ? candidates : demoCandidates(criteria),
      mode: "live",
      grounded: research != null,
    };
  } catch {
    return { candidates: demoCandidates(criteria), mode: "demo", grounded: false };
  }
}

/** Deterministische Demo-Kandidaten für die Preview ohne API-Key. */
export function demoCandidates(c: DiscoveryCriteria): LeadCandidate[] {
  const region = c.region || "DACH";
  const branche = c.branche || "Handwerk";
  const base: Array<[string, string, RecommendedLine, number]> = [
    ["Beispielbetrieb Nord GmbH", `${branche}`, "beide", 82],
    ["Muster Dienstleistungen e.K.", `${branche}`, "ki", 76],
    ["Regional Service AG", `${branche}`, "recruiting", 71],
    ["Lokal & Partner", `${branche}`, "ki", 67],
  ];
  return base.map(([company, industry, line, score]) => ({
    company,
    location: region,
    industry,
    why_fit:
      line === "recruiting"
        ? "Offene Fachkräfte-Stellen, hoher Besetzungsdruck."
        : line === "beide"
          ? "Hohes Anrufaufkommen + offene Stellen – Doppel-Ansatz."
          : "Viele telefonische Anfragen, Erreichbarkeit ausbaufähig.",
    recommended_line: line,
    fit_score: score,
  }));
}
