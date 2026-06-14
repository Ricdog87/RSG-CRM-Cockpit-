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

export type Priority = "hoch" | "mittel" | "niedrig";

/** Eingabe für das Opportunity-Scoring. */
export interface OppScoreInput {
  account_name: string;
  line: string;
  title: string;
  value: number;
  value_type: string;
  stage: string;
  probability: number;
}

/** KI-Bewertung einer Verkaufschance. */
export interface OppScore {
  /** Priorisierungs-Score 0–100 */
  score: number;
  priority: Priority;
  /** die EINE konkrete nächste Aktion */
  next_action: string;
  /** kurze Begründung */
  reasoning: string;
  /** "live" = echtes LLM, "demo" = Heuristik */
  mode: "live" | "demo";
}

/** Eine Verkaufschance inkl. KI-Bewertung (für die Priorisierungsliste). */
export interface ScoredOpp {
  id: string;
  account_name: string;
  title: string;
  line: string;
  value: number;
  value_type: string;
  stage: string;
  probability: number;
  score: OppScore;
}

/** Ein von der KI vorgeschlagener Ziel-Account (Lead-Discovery). */
export interface LeadCandidate {
  company: string;
  location: string;
  industry: string;
  why_fit: string;
  recommended_line: RecommendedLine;
  fit_score: number;
}

export interface DiscoveryCriteria {
  branche?: string;
  region?: string;
  size?: string;
  focus?: "ki" | "recruiting" | "beide";
  notes?: string;
}

export interface DiscoveryResult {
  candidates: LeadCandidate[];
  mode: "live" | "demo";
  grounded: boolean;
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
