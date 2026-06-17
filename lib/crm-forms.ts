import type { FormField } from "@/components/cockpit/EntityFormDialog";
import type { Candidate } from "@/lib/crm-types";

/**
 * Vorbelegung für den Kandidaten-Bearbeiten-Dialog – MUSS alle bearbeitbaren
 * Felder enthalten, sonst werden nicht vorbefüllte Felder beim Speichern geleert.
 */
export function candidateInitial(c: Candidate): Record<string, string> {
  return {
    salutation: c.salutation ?? "",
    title: c.title ?? "",
    name: c.name,
    role: c.role,
    email: c.email ?? "",
    phone: c.phone ?? "",
    mandate_account: c.mandate_account,
    mandate_id: c.mandate_id ?? "",
    stage: c.stage,
    source: c.source,
    location: c.location ?? "",
    zip: c.zip ?? "",
    willing_to_relocate:
      c.willing_to_relocate == null ? "" : c.willing_to_relocate ? "ja" : "nein",
    travel_willingness: c.travel_willingness ?? "",
    salary_expectation: c.salary_expectation != null ? String(c.salary_expectation) : "",
    availability: c.availability ?? "",
  };
}

/** Feldkonfiguration für Account-Formulare (Anlegen + Bearbeiten). */
export const ACCOUNT_FIELDS: FormField[] = [
  { name: "name", label: "Unternehmen", required: true, full: true, placeholder: "Muster GmbH" },
  {
    name: "line",
    label: "Geschäftslinie",
    type: "select",
    options: [
      { value: "ki", label: "KI & Telefonassistenz" },
      { value: "recruiting", label: "Personalvermittlung" },
    ],
  },
  {
    name: "lifecycle",
    label: "Phase",
    type: "select",
    options: [
      { value: "lead", label: "Lead" },
      { value: "opportunity", label: "Opportunity" },
      { value: "kunde", label: "Kunde" },
      { value: "bestand", label: "Bestand" },
    ],
  },
  { name: "branche", label: "Branche", placeholder: "z.B. Gesundheit" },
  { name: "segment", label: "Segment", placeholder: "z.B. Praxen" },
  { name: "ort", label: "Ort" },
  { name: "country", label: "Land/Region", placeholder: "Germany" },
  { name: "contact_name", label: "Ansprechpartner:in" },
  { name: "contact_email", label: "E-Mail", type: "email" },
  { name: "contact_phone", label: "Telefon", placeholder: "+49 …" },
  { name: "owner", label: "Zuständige:r Mitarbeiter:in" },
  { name: "mrr", label: "MRR (€)", type: "number", placeholder: "0" },
];

export const CANDIDATE_FIELDS: FormField[] = [
  {
    name: "salutation",
    label: "Anrede",
    type: "select",
    options: [
      { value: "", label: "—" },
      { value: "Herr", label: "Herr" },
      { value: "Frau", label: "Frau" },
      { value: "Divers", label: "Divers" },
    ],
  },
  { name: "title", label: "Titel", placeholder: "z.B. Dr." },
  { name: "name", label: "Name", required: true, placeholder: "Vor- und Nachname" },
  { name: "role", label: "Position", placeholder: "z.B. Pflegefachkraft" },
  { name: "email", label: "E-Mail", type: "email", placeholder: "name@beispiel.de" },
  { name: "phone", label: "Telefon", placeholder: "+49 …" },
  { name: "mandate_account", label: "Mandat (Account)", full: true },
  {
    name: "mandate_id",
    label: "Mandat / Suchprojekt",
    type: "select",
    full: true,
    options: [{ value: "", label: "— kein Mandat —" }],
  },
  {
    name: "stage",
    label: "Phase",
    type: "select",
    options: [
      { value: "neu", label: "Neu" },
      { value: "screening", label: "Screening" },
      { value: "interview", label: "Interview" },
      { value: "angebot", label: "Angebot" },
      { value: "platziert", label: "Platziert" },
      { value: "abgelehnt", label: "Absage" },
    ],
  },
  { name: "source", label: "Quelle", placeholder: "z.B. LinkedIn" },
  { name: "location", label: "Ort", placeholder: "z.B. Frankfurt" },
  { name: "zip", label: "PLZ", placeholder: "z.B. 60311" },
  {
    name: "willing_to_relocate",
    label: "Umzugsbereit",
    type: "select",
    options: [
      { value: "", label: "—" },
      { value: "ja", label: "Ja" },
      { value: "nein", label: "Nein" },
    ],
  },
  { name: "travel_willingness", label: "Reisebereitschaft", placeholder: "z.B. bis 50 %" },
  { name: "salary_expectation", label: "Gehaltsvorstellung (€/Jahr)", type: "number", placeholder: "z.B. 65000" },
  { name: "availability", label: "Verfügbarkeit", placeholder: "z.B. ab sofort / in 3 Monaten" },
];

export const MANDATE_FIELDS: FormField[] = [
  { name: "account_name", label: "Account", required: true, full: true, placeholder: "Muster GmbH" },
  { name: "role", label: "Position", full: true, placeholder: "z.B. Pflegefachkraft (m/w/d)" },
  { name: "positions", label: "Anzahl Stellen", type: "number", placeholder: "1" },
  { name: "filled", label: "Davon besetzt", type: "number", placeholder: "0" },
  { name: "fee", label: "Festpreis je Stelle (€)", type: "number", placeholder: "9999" },
  {
    name: "status",
    label: "Status",
    type: "select",
    options: [
      { value: "offen", label: "Offen" },
      { value: "in_arbeit", label: "In Arbeit" },
      { value: "interviews", label: "Interviews" },
      { value: "besetzt", label: "Besetzt" },
      { value: "pausiert", label: "Pausiert" },
    ],
  },
  { name: "deadline", label: "Deadline", type: "date" },
];

export const SEGMENT_FIELDS: FormField[] = [
  { name: "name", label: "Segmentname", required: true, full: true, placeholder: "z.B. Handwerk & Bau" },
  { name: "description", label: "Beschreibung", type: "textarea", full: true },
  { name: "top_product", label: "Top-Produkt", placeholder: "z.B. Autonome KI-Agenten" },
];

export const KIPROJECT_FIELDS: FormField[] = [
  { name: "account_name", label: "Account", required: true, full: true, placeholder: "Muster GmbH" },
  { name: "product", label: "Produkt", placeholder: "z.B. Autonome KI-Agenten" },
  { name: "segment", label: "Segment" },
  {
    name: "status",
    label: "Status",
    type: "select",
    options: [
      { value: "onboarding", label: "Onboarding" },
      { value: "live", label: "Live" },
      { value: "optimierung", label: "Optimierung" },
      { value: "pausiert", label: "Pausiert" },
      { value: "gekuendigt", label: "Gekündigt" },
    ],
  },
  {
    name: "health",
    label: "Health",
    type: "select",
    options: [
      { value: "gut", label: "Gesund" },
      { value: "neutral", label: "Stabil" },
      { value: "risiko", label: "Risiko" },
    ],
  },
  {
    name: "setup_fee",
    label: "Implementierung (€, einmalig)",
    type: "number",
    placeholder: "z.B. 2500",
  },
  {
    name: "mrr",
    label: "Monatl. Fixpreis (€)",
    type: "number",
    placeholder: "Token, Wartung & Updates",
  },
  { name: "go_live", label: "Go-Live", type: "date" },
  { name: "use_case", label: "Use-Case", type: "textarea", full: true, placeholder: "Was automatisiert die KI? Ziel & Erfolgskriterien." },
  { name: "project_manager", label: "Projektverantwortlich (intern)" },
  { name: "kickoff_date", label: "Kickoff", type: "date" },
  { name: "decision_maker", label: "Entscheider (Kunde)" },
  { name: "tech_contact", label: "Technischer Ansprechpartner" },
  // Kundendaten – wandern automatisch in den Account, falls der Kunde neu ist.
  { name: "acc_branche", label: "Kunde: Branche", placeholder: "nur falls neuer Kunde" },
  { name: "acc_ort", label: "Kunde: Ort" },
  { name: "acc_contact_name", label: "Kunde: Ansprechpartner:in" },
  { name: "acc_contact_email", label: "Kunde: E-Mail", type: "email" },
];

export const OPPORTUNITY_FIELDS: FormField[] = [
  { name: "account_name", label: "Account", required: true, full: true, placeholder: "Muster GmbH" },
  { name: "title", label: "Titel", full: true, placeholder: "z.B. Autonome KI-Agenten" },
  {
    name: "line",
    label: "Geschäftslinie",
    type: "select",
    options: [
      { value: "ki", label: "KI & Telefonassistenz" },
      { value: "recruiting", label: "Personalvermittlung" },
    ],
  },
  {
    name: "value_type",
    label: "Wert-Typ",
    type: "select",
    options: [
      { value: "mrr", label: "MRR (monatlich)" },
      { value: "fixed", label: "Festpreis" },
    ],
  },
  { name: "value", label: "Wert (€)", type: "number", placeholder: "0" },
  { name: "probability", label: "Wahrscheinlichkeit (%)", type: "number", placeholder: "0" },
  {
    name: "stage",
    label: "Phase",
    type: "select",
    options: [
      { value: "neu", label: "Neu" },
      { value: "qualifiziert", label: "Qualifiziert" },
      { value: "demo", label: "Demo/Termin" },
      { value: "angebot", label: "Angebot" },
      { value: "verhandlung", label: "Verhandlung" },
      { value: "gewonnen", label: "Gewonnen" },
    ],
  },
  { name: "owner", label: "Verantwortlich" },
  { name: "expected_close", label: "Erwarteter Abschluss", type: "date" },
];

/**
 * Wandelt ein Freitextfeld in ein Autocomplete-Feld (datalist) mit den
 * angegebenen Werten – z.B. um bestehende Accounts vorzuschlagen.
 */
export function withDatalist(
  fields: FormField[],
  fieldName: string,
  values: string[]
): FormField[] {
  const options = Array.from(new Set(values.filter(Boolean))).map((v) => ({
    value: v,
    label: v,
  }));
  return fields.map((f) =>
    f.name === fieldName ? { ...f, type: "datalist" as const, options } : f
  );
}

/**
 * Wandelt ein Feld in eine Combobox (Tippen + Vorschläge, Freitext erlaubt →
 * neue Einträge werden angelegt). Besser als datalist bei vielen Optionen.
 */
export function withCombobox(
  fields: FormField[],
  fieldName: string,
  values: string[]
): FormField[] {
  const options = Array.from(new Set(values.filter(Boolean))).map((v) => ({ value: v, label: v }));
  return fields.map((f) =>
    f.name === fieldName ? { ...f, type: "combobox" as const, options } : f
  );
}

/** Setzt die Optionen eines Select-Feldes (z.B. Mandate fürs Kandidaten-Formular). */
export function withSelectOptions(
  fields: FormField[],
  fieldName: string,
  options: { value: string; label: string }[]
): FormField[] {
  return fields.map((f) => (f.name === fieldName ? { ...f, options } : f));
}
