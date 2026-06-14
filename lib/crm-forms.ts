import type { FormField } from "@/components/cockpit/EntityFormDialog";

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
  { name: "contact_name", label: "Ansprechpartner:in" },
  { name: "contact_email", label: "E-Mail", type: "email" },
  { name: "mrr", label: "MRR (€)", type: "number", placeholder: "0" },
];

export const CANDIDATE_FIELDS: FormField[] = [
  { name: "name", label: "Name", required: true, placeholder: "Vor- und Nachname" },
  { name: "role", label: "Position", placeholder: "z.B. Pflegefachkraft" },
  { name: "mandate_account", label: "Mandat (Account)", full: true },
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
    ],
  },
  { name: "source", label: "Quelle", placeholder: "z.B. LinkedIn" },
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
  { name: "top_product", label: "Top-Produkt", placeholder: "z.B. AI Account Manager" },
];

export const KIPROJECT_FIELDS: FormField[] = [
  { name: "account_name", label: "Account", required: true, full: true, placeholder: "Muster GmbH" },
  { name: "product", label: "Produkt", placeholder: "z.B. AI Account Manager" },
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
  { name: "mrr", label: "MRR (€)", type: "number", placeholder: "0" },
  { name: "go_live", label: "Go-Live", type: "date" },
];

export const OPPORTUNITY_FIELDS: FormField[] = [
  { name: "account_name", label: "Account", required: true, full: true, placeholder: "Muster GmbH" },
  { name: "title", label: "Titel", full: true, placeholder: "z.B. AI Account Manager" },
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
