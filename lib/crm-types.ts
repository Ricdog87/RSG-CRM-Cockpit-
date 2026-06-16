/**
 * Datenmodell für das hausinterne RSG-CRM (HubSpot-Ablösung).
 * Zwei Geschäftslinien: RSG AI (KI-Telefonassistenz/Automatisierung) und
 * RSG Recruiting (Personalvermittlung zum Festpreis).
 *
 * Diese Entitäten bilden künftige Supabase-Tabellen ab (accounts, opportunities,
 * projects, candidates, segments). Bis zur Migration liefern sie Mock-Daten.
 */

export type BusinessLine = "ki" | "recruiting";

export const lineLabel: Record<BusinessLine, string> = {
  ki: "KI & Telefonassistenz",
  recruiting: "Personalvermittlung",
};

export type Lifecycle = "lead" | "opportunity" | "kunde" | "bestand";

/** Account = Unternehmen/Kunde (Customer Management). */
export interface Account {
  id: string;
  name: string;
  branche: string;
  segment: string;
  line: BusinessLine;
  lifecycle: Lifecycle;
  contact_name: string;
  contact_email: string;
  /** monatlich wiederkehrender Umsatz (KI), 0 bei Recruiting */
  mrr: number;
  ort: string;
  since: string;
}

export type SalesStage =
  | "neu"
  | "qualifiziert"
  | "demo"
  | "angebot"
  | "verhandlung"
  | "gewonnen"
  | "verloren";

/** Opportunity = Projekt-Verkaufschance (Sales-Pipeline). */
export interface Opportunity {
  id: string;
  account_name: string;
  line: BusinessLine;
  title: string;
  /** MRR (KI) bzw. Festpreis-Volumen (Recruiting) in € */
  value: number;
  value_type: "mrr" | "fixed";
  stage: SalesStage;
  probability: number;
  owner: string;
  expected_close: string;
}

export type KiStatus =
  | "onboarding"
  | "live"
  | "optimierung"
  | "pausiert"
  | "gekuendigt";

export type Health = "gut" | "neutral" | "risiko";

/** KI- & Telefonassistenz-Projekt (Umsetzung bei aktiven KI-Kunden). */
export interface KiProject {
  id: string;
  account_name: string;
  product: string;
  segment: string;
  status: KiStatus;
  mrr: number;
  go_live: string;
  health: Health;
}

export type MandateStatus =
  | "offen"
  | "in_arbeit"
  | "interviews"
  | "besetzt"
  | "pausiert";

/** Personalvermittlungs-Projekt (Recruiting-Mandat). */
export interface RecruitingMandate {
  id: string;
  account_name: string;
  role: string;
  positions: number;
  filled: number;
  status: MandateStatus;
  /** Festpreis je besetzter Stelle (€) */
  fee: number;
  candidate_count: number;
  deadline: string;
  /** Preismodell: Festpreis je Stelle ODER % vom Bruttojahreszielgehalt. */
  pricing_model?: "fixed" | "percent";
  /** Bruttojahreszielgehalt (€) – für pricing_model "percent". */
  target_salary?: number;
  /** Honorarsatz in % – für pricing_model "percent". */
  fee_percent?: number;
}

/** Erwarteter Umsatz eines Mandats (über alle Stellen). */
export function mandateRevenue(m: RecruitingMandate): number {
  const perPosition =
    m.pricing_model === "percent"
      ? (m.target_salary ?? 0) * ((m.fee_percent ?? 0) / 100)
      : m.fee;
  return Math.round(perPosition * (m.positions || 1));
}

export type CandidateStage =
  | "neu"
  | "screening"
  | "interview"
  | "angebot"
  | "platziert"
  | "abgelehnt";

/** Kandidat:in in der Recruiting-Pipeline. */
export interface Candidate {
  id: string;
  name: string;
  role: string;
  mandate_account: string;
  /** Verknüpftes Suchprojekt/Mandat (recruiting_mandates.id). */
  mandate_id?: string;
  stage: CandidateStage;
  source: string;
  updated_at: string;
  /** Fortlaufende Kandidaten-Nummer (DB-Sequence). */
  candidate_no?: number;
  /** Profilfoto im Bucket candidate-photos. */
  photo_path?: string;
  /** Anrede (Herr/Frau/Divers) + akad. Titel (z.B. Dr.) fuer professionelle Anschrift. */
  salutation?: string;
  title?: string;
  /** Kontaktdaten (z.B. automatisch aus dem CV extrahiert) */
  email?: string;
  phone?: string;
  /** Pfad der CV-Datei im privaten Storage-Bucket `candidate-cvs` */
  cv_path?: string;
  cv_filename?: string;
  /** Zeitpunkt des CV-Uploads (ISO) */
  cv_uploaded_at?: string;
  /** Skill-Set (z.B. aus dem CV extrahiert) */
  skills?: string[];
  /** Bewertung 0–5 Sterne */
  rating?: number;
  /** Freie Tags zum Filtern/Priorisieren */
  tags?: string[];
}

/** KI-Kundensegment (für Zielgruppen-/Use-Case-Steuerung). */
export interface Segment {
  id: string;
  name: string;
  description: string;
  accounts: number;
  mrr: number;
  top_product: string;
}
