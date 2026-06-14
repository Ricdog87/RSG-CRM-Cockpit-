/** Strukturiertes Ergebnis der KI-Lead-Analyse. */
export type RecommendedLine = "ki" | "recruiting" | "beide" | "keine";
export type Confidence = "hoch" | "mittel" | "niedrig";

export interface LeadAnalysis {
  company: string;
  industry: string;
  size_estimate: string;
  location: string;
  /** prägnante Einordnung des Unternehmens */
  summary: string;
  /** Eignung als RSG-Kunde, 0–100 */
  fit_score: number;
  recommended_line: RecommendedLine;
  /** Kaufsignale / Anlässe */
  signals: string[];
  /** vermutete Schmerzpunkte */
  pain_points: string[];
  /** konkrete Gesprächsaufhänger */
  talking_points: string[];
  /** Entwurf einer Erstansprache (deutsch) */
  outreach_email: string;
  confidence: Confidence;
}

export interface LeadInput {
  company: string;
  domain?: string;
  notes?: string;
}

export interface LeadResult {
  analysis: LeadAnalysis;
  /** "live" = echtes LLM, "demo" = Mock ohne API-Key */
  mode: "live" | "demo";
  /** true ⇒ mit Perplexity-Webrecherche angereichert */
  grounded: boolean;
  /** genutztes Modell (z.B. claude-opus-4-8) */
  model: string;
}
