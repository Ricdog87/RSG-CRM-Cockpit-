/**
 * Schema-Registry für den CSV-Direktimport (HubSpot-Vorbild).
 * Client-safe: nur Daten, keine Server-Imports. Die Server-Action
 * `importRows` (lib/import-actions.ts) nutzt dieselbe Registry.
 */

export type FieldType = "text" | "number" | "date";

export interface ImportField {
  /** Spaltenname in der DB (bzw. virtuelles Feld, z.B. „account"). */
  key: string;
  label: string;
  required?: boolean;
  type?: FieldType;
  /** Header-Hinweise für die automatische Spaltenzuordnung. */
  hints?: string[];
}

export interface DedupeOption {
  /** Feld-Key oder „id" (Datensatz-ID) oder „" (kein Abgleich). */
  key: string;
  label: string;
}

export interface ImportObject {
  key: string;
  label: string;
  description: string;
  table: string;
  fields: ImportField[];
  dedupe: DedupeOption[];
  /** Feld, dessen Wert ein Account-Name ist und zu account_id aufgelöst wird. */
  accountRefField?: string;
}

const ID_DEDUPE: DedupeOption = { key: "id", label: "Datensatz-ID (id)" };
const NO_DEDUPE: DedupeOption = { key: "", label: "Kein Abgleich – alle neu anlegen" };

export const IMPORT_OBJECTS: ImportObject[] = [
  {
    key: "accounts",
    label: "Kunden / Accounts",
    description: "Unternehmen mit Branche, Kontakt und Lifecycle.",
    table: "accounts",
    fields: [
      { key: "name", label: "Firmenname", required: true, hints: ["name", "firma", "unternehmen", "company", "account"] },
      { key: "branche", label: "Branche", hints: ["branche", "industry"] },
      { key: "segment", label: "Segment", hints: ["segment"] },
      { key: "line", label: "Geschäftslinie (ki/recruiting)", hints: ["line", "linie", "geschäftslinie"] },
      { key: "lifecycle", label: "Lifecycle (lead/opportunity/kunde/bestand)", hints: ["lifecycle", "phase", "status"] },
      { key: "contact_name", label: "Ansprechpartner", hints: ["contact_name", "ansprechpartner", "kontakt"] },
      { key: "contact_email", label: "E-Mail", type: "text", hints: ["email", "e-mail", "mail"] },
      { key: "mrr", label: "MRR (€)", type: "number", hints: ["mrr", "umsatz", "wert"] },
      { key: "ort", label: "Ort", hints: ["ort", "stadt", "city", "standort"] },
    ],
    dedupe: [
      { key: "name", label: "Firmenname" },
      { key: "contact_email", label: "E-Mail" },
      ID_DEDUPE,
      NO_DEDUPE,
    ],
  },
  {
    key: "candidates",
    label: "Kandidaten",
    description: "Personen der Recruiting-Pipeline.",
    table: "candidates",
    fields: [
      { key: "name", label: "Name", required: true, hints: ["name", "kandidat", "person"] },
      { key: "role", label: "Position / Rolle", hints: ["role", "position", "rolle", "beruf", "titel"] },
      { key: "email", label: "E-Mail", type: "text", hints: ["email", "e-mail", "mail"] },
      { key: "phone", label: "Telefon", hints: ["phone", "telefon", "tel", "mobil"] },
      { key: "mandate_account", label: "Mandat / Account", hints: ["mandate", "mandat", "account", "kunde", "unternehmen"] },
      { key: "stage", label: "Phase (neu/screening/interview/angebot/platziert)", hints: ["stage", "phase", "status"] },
      { key: "source", label: "Quelle", hints: ["source", "quelle", "herkunft"] },
    ],
    dedupe: [
      { key: "email", label: "E-Mail" },
      { key: "name", label: "Name" },
      ID_DEDUPE,
      NO_DEDUPE,
    ],
  },
  {
    key: "account_contacts",
    label: "Ansprechpartner",
    description: "Kontaktpersonen, einem Account zugeordnet.",
    table: "account_contacts",
    accountRefField: "account",
    fields: [
      { key: "account", label: "Account (Firmenname)", required: true, hints: ["account", "firma", "unternehmen", "company", "kunde"] },
      { key: "name", label: "Name", required: true, hints: ["name", "kontakt", "ansprechpartner", "person"] },
      { key: "role", label: "Position / Rolle", hints: ["role", "position", "rolle", "funktion", "titel"] },
      { key: "email", label: "E-Mail", type: "text", hints: ["email", "e-mail", "mail"] },
      { key: "phone", label: "Telefon", hints: ["phone", "telefon", "tel", "mobil"] },
    ],
    dedupe: [
      { key: "email", label: "E-Mail" },
      ID_DEDUPE,
      NO_DEDUPE,
    ],
  },
  {
    key: "ki_projects",
    label: "Projekte · KI & Telefonassistenz",
    description: "KI-Projekte mit Produkt, Status und MRR.",
    table: "ki_projects",
    fields: [
      { key: "account_name", label: "Account (Firmenname)", required: true, hints: ["account", "firma", "unternehmen", "kunde"] },
      { key: "product", label: "Produkt", hints: ["product", "produkt"] },
      { key: "segment", label: "Segment", hints: ["segment"] },
      { key: "status", label: "Status (onboarding/live/…)", hints: ["status", "phase"] },
      { key: "mrr", label: "MRR (€)", type: "number", hints: ["mrr", "umsatz"] },
      { key: "go_live", label: "Go-Live (Datum)", type: "date", hints: ["go_live", "golive", "live", "datum", "start"] },
      { key: "health", label: "Health (gut/neutral/kritisch)", hints: ["health", "status"] },
    ],
    dedupe: [ID_DEDUPE, NO_DEDUPE],
  },
  {
    key: "recruiting_mandates",
    label: "Projekte · Personalvermittlung",
    description: "Recruiting-Mandate mit Rolle, Stellen und Honorar.",
    table: "recruiting_mandates",
    fields: [
      { key: "account_name", label: "Account (Firmenname)", required: true, hints: ["account", "firma", "unternehmen", "kunde"] },
      { key: "role", label: "Zu besetzende Rolle", required: true, hints: ["role", "rolle", "position", "stelle"] },
      { key: "positions", label: "Anzahl Stellen", type: "number", hints: ["positions", "stellen", "anzahl"] },
      { key: "status", label: "Status (offen/laufend/besetzt)", hints: ["status", "phase"] },
      { key: "fee", label: "Honorar (€)", type: "number", hints: ["fee", "honorar", "fixum", "preis"] },
      { key: "deadline", label: "Deadline (Datum)", type: "date", hints: ["deadline", "frist", "datum"] },
    ],
    dedupe: [ID_DEDUPE, NO_DEDUPE],
  },
];

export function findImportObject(key: string): ImportObject | undefined {
  return IMPORT_OBJECTS.find((o) => o.key === key);
}

/** Schlägt für ein Feld die am besten passende CSV-Spalte vor (Index oder -1). */
export function guessColumn(field: ImportField, headers: string[]): number {
  const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9äöüß]/g, "");
  const hdr = headers.map(norm);
  const cands = [field.key, field.label, ...(field.hints ?? [])].map(norm);
  // exakter Treffer zuerst
  for (const c of cands) {
    const i = hdr.indexOf(c);
    if (i >= 0) return i;
  }
  // Teil-Treffer
  for (const c of cands) {
    const i = hdr.findIndex((h) => h.includes(c) || c.includes(h));
    if (i >= 0 && hdr[i].length > 1) return i;
  }
  return -1;
}
