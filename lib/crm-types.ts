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
  contact_phone?: string;
  /** monatlich wiederkehrender Umsatz (KI), 0 bei Recruiting */
  mrr: number;
  ort: string;
  since: string;
  /** Vermittlungsvertrag/AGB: Mandatsart, Vertragsstatus, Unterzeichnung, Honorarvereinbarung. */
  engagement_type?: "exklusiv" | "nicht_exklusiv" | "retainer";
  contract_status?: "kein" | "versendet" | "unterzeichnet";
  contract_signed_at?: string;
  fee_agreement?: string;
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
  /** monatlicher Fixpreis (€) – Token, Wartung & Updates */
  mrr: number;
  /** einmalige Implementierungs-/Installationskosten (€) bei Projektstart */
  setup_fee?: number;
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
  /** Anzahlung je Stelle (€) – fix bei Auftrag, Rest bei Vermittlung. */
  deposit?: number;
  /**
   * Erfolgshonorar 50/50 splitten: 50 % bei Vertragsunterzeichnung,
   * 50 % nach 3 Monaten Betriebszugehörigkeit.
   */
  split_payment?: boolean;
  /** Original-Stellenausschreibung des Kunden (Volltext). */
  job_posting?: string;
  /** Anonymisierte Fassung der Stellenausschreibung (ohne Kundenbezug). */
  job_posting_anonymized?: string;
  /** Öffentlicher Token für die Stellen-Seite (/stelle/<token>). */
  share_token?: string;
  /** Anlagedatum (für Time-to-Fill). */
  created_at?: string;
}

/** Honorar je Stelle (Festpreis ODER % vom Zielgehalt). */
export function mandateFeePerPosition(m: RecruitingMandate): number {
  return m.pricing_model === "percent"
    ? (m.target_salary ?? 0) * ((m.fee_percent ?? 0) / 100)
    : m.fee;
}

/** Erwarteter Umsatz eines Mandats (über alle Stellen). */
export function mandateRevenue(m: RecruitingMandate): number {
  return Math.round(mandateFeePerPosition(m) * (m.positions || 1));
}

export interface PaymentMilestone {
  label: string;
  amount: number;
}

/**
 * Zahlungsplan eines Mandats (über alle Stellen): Anzahlung bei Auftrag,
 * danach Erfolgshonorar – optional 50/50 gesplittet (Unterzeichnung /
 * nach 3 Monaten Betriebszugehörigkeit).
 */
export function mandatePaymentSchedule(m: RecruitingMandate): PaymentMilestone[] {
  const positions = m.positions || 1;
  const total = mandateRevenue(m);
  const deposit = Math.round((m.deposit ?? 0) * positions);
  const plan: PaymentMilestone[] = [];

  if (deposit > 0) {
    plan.push({ label: "Anzahlung bei Auftrag", amount: Math.min(deposit, total) });
  }
  const success = Math.max(0, total - deposit);

  if (m.split_payment) {
    const first = Math.round(success / 2);
    plan.push({ label: "50 % bei Vertragsunterzeichnung", amount: first });
    plan.push({ label: "50 % nach 3 Monaten Betriebszugehörigkeit", amount: success - first });
  } else if (success > 0) {
    plan.push({
      label: deposit > 0 ? "Restbetrag bei erfolgreicher Vermittlung" : "Honorar bei erfolgreicher Vermittlung",
      amount: success,
    });
  }
  return plan;
}

export type CandidateStage =
  | "neu"
  | "screening"
  | "interview"
  | "angebot"
  | "platziert"
  | "abgelehnt";

export type PlacementStatus = "aktiv" | "garantie_ok" | "ausgefallen" | "nachbesetzung";

/** Erfolgreiche Vermittlung: Eintritt, Garantie/Probezeit und Status. */
export interface Placement {
  id: string;
  candidate_id?: string;
  mandate_id?: string;
  candidate_name: string;
  account_name: string;
  role: string;
  /** Eintrittsdatum (ISO yyyy-mm-dd). */
  start_date?: string;
  /** Vereinbartes Gesamthonorar (€). */
  agreed_fee?: number;
  /** Probezeit-/Garantiedauer in Monaten. */
  guarantee_months: number;
  status: PlacementStatus;
  notes?: string;
  created_at?: string;
}

function addMonths(iso: string, months: number): string | undefined {
  if (!iso) return undefined;
  const d = new Date(iso + "T00:00:00");
  if (Number.isNaN(d.getTime())) return undefined;
  const day = d.getDate();
  d.setMonth(d.getMonth() + months);
  // Monatsüberlauf abfangen (z.B. 31.01. + 1 Monat).
  if (d.getDate() < day) d.setDate(0);
  return d.toISOString().slice(0, 10);
}

/** Fälligkeitsdatum der 2. Rate (50 % nach 3 Monaten Betriebszugehörigkeit). */
export function placementSplitDate(p: Pick<Placement, "start_date">): string | undefined {
  return p.start_date ? addMonths(p.start_date, 3) : undefined;
}

/** Ende der Probezeit/Garantie (Eintritt + Garantiemonate). */
export function placementGuaranteeUntil(
  p: Pick<Placement, "start_date" | "guarantee_months">
): string | undefined {
  return p.start_date ? addMonths(p.start_date, p.guarantee_months || 6) : undefined;
}

export type InterviewType = "telefon" | "video" | "vor_ort" | "kundengespraech";
export type InterviewStatus = "geplant" | "stattgefunden" | "abgesagt" | "verschoben";

/** Strukturiertes Interview je Kandidat:in (Termin, Art, Feedback). */
export interface Interview {
  id: string;
  candidate_id: string;
  mandate_id?: string;
  scheduled_at?: string;
  type: InterviewType;
  interviewer?: string;
  location?: string;
  status: InterviewStatus;
  score?: number;
  feedback?: string;
  created_at?: string;
}

export type InvoiceStatus = "entwurf" | "gestellt" | "bezahlt";

/** Honorar-Rechnung an den Kunden (an den Zahlungsplan gekoppelt). */
export interface Invoice {
  id: string;
  mandate_id?: string;
  placement_id?: string;
  account_name: string;
  role?: string;
  label?: string;
  amount: number;
  issue_date?: string;
  due_date?: string;
  paid_date?: string;
  invoice_no?: string;
  status: InvoiceStatus;
  notes?: string;
  created_at?: string;
}

/** Überfällig: gestellt, fällig in der Vergangenheit, noch nicht bezahlt. */
export function invoiceOverdue(inv: Pick<Invoice, "status" | "due_date">): boolean {
  if (inv.status !== "gestellt" || !inv.due_date) return false;
  return inv.due_date < new Date().toISOString().slice(0, 10);
}

export type OfferStatus = "entwurf" | "versendet" | "in_verhandlung" | "angenommen" | "abgelehnt";

/** Angebot je Kandidat:in (Gehalt, Eintritt, Status, Ablehnungsgrund). */
export interface Offer {
  id: string;
  candidate_id: string;
  mandate_id?: string;
  offered_salary?: number;
  start_date?: string;
  offer_date?: string;
  status: OfferStatus;
  decline_reason?: string;
  notes?: string;
  created_at?: string;
}

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
  /** Matching: Standort, PLZ, Mobilität, Gehalt, Verfügbarkeit */
  location?: string;
  zip?: string;
  willing_to_relocate?: boolean;
  travel_willingness?: string;
  salary_expectation?: number;
  availability?: string;
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
