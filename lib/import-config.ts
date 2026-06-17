/**
 * Schema-Registry für den CSV-Direktimport (HubSpot-Vorbild).
 * Client-safe: nur Daten, keine Server-Imports. Die Server-Action
 * `importRows` (lib/import-actions.ts) nutzt dieselbe Registry.
 */

export type FieldType = "text" | "number" | "date" | "datetime";

export interface ImportField {
  /** Spaltenname in der DB (bzw. virtuelles Feld, z.B. „account"/„candidate"). */
  key: string;
  label: string;
  required?: boolean;
  type?: FieldType;
  /** Header-Hinweise für die automatische Spaltenzuordnung. */
  hints?: string[];
  /** Beispielwert für die Beispiel-CSV. */
  sample?: string;
}

export interface DedupeOption {
  key: string;
  label: string;
}

/** Auflösung eines Eltern-Datensatzes (Account/Kandidat) über Name/E-Mail. */
export interface ParentRef {
  /** virtuelles Feld, dessen Wert den Elterndatensatz identifiziert */
  field: string;
  /** Eltern-Tabelle */
  table: string;
  /** Spalten, gegen die gematcht wird (in Reihenfolge) */
  matchColumns: string[];
  /** DB-Spalte, die die Eltern-id erhält (z.B. account_id / candidate_id / related_id) */
  setId: string;
  /** optionale DB-Spalte für den Eltern-Namen (z.B. related_label) */
  setLabel?: string;
}

export interface ImportObject {
  key: string;
  label: string;
  group: "Datensätze" | "Aktivitäten";
  description: string;
  table: string;
  fields: ImportField[];
  dedupe: DedupeOption[];
  /** konstante Spalten bei jedem Insert (z.B. kind:"call", related_type:"candidate") */
  fixed?: Record<string, unknown>;
  /** Eltern-Auflösung (Ansprechpartner→Account, Aktivität→Kandidat) */
  parentRef?: ParentRef;
}

const ID_DEDUPE: DedupeOption = { key: "id", label: "Datensatz-ID (id)" };
const NO_DEDUPE: DedupeOption = { key: "", label: "Kein Abgleich – alle neu anlegen" };

// Virtuelle Eltern-Felder (Wert = Name oder E-Mail des Elterndatensatzes).
const ACCOUNT_FIELD: ImportField = {
  key: "account",
  label: "Account (Firmenname)",
  required: true,
  hints: ["account", "firma", "unternehmen", "company", "kunde"],
  sample: "Hofmann Dental MVZ",
};
const CANDIDATE_FIELD: ImportField = {
  key: "candidate",
  label: "Kandidat:in (E-Mail oder Name)",
  required: true,
  hints: ["candidate", "kandidat", "email", "e-mail", "name", "person"],
  sample: "anna.decker@example.com",
};
const ACTIVITY_DATE: ImportField = {
  key: "created_at",
  label: "Aktivitätsdatum",
  type: "datetime",
  hints: ["activity date", "aktivitätsdatum", "datum", "date", "zeit"],
  sample: "2026-06-14 10:30",
};

export const IMPORT_OBJECTS: ImportObject[] = [
  // ───────────────────────── Datensätze ─────────────────────────
  {
    key: "accounts",
    label: "Kunden / Accounts",
    group: "Datensätze",
    description: "Unternehmen mit Branche, Kontakt und Lifecycle.",
    table: "accounts",
    fields: [
      { key: "name", label: "Firmenname", required: true, hints: ["name", "firma", "unternehmen", "company", "account"], sample: "Hofmann Dental MVZ" },
      { key: "branche", label: "Branche", hints: ["branche", "industry"], sample: "Gesundheit" },
      { key: "segment", label: "Segment", hints: ["segment"], sample: "Praxen" },
      { key: "line", label: "Geschäftslinie (ki/recruiting)", hints: ["line", "linie", "geschäftslinie"], sample: "ki" },
      { key: "lifecycle", label: "Lifecycle (lead/opportunity/kunde/bestand)", hints: ["lifecycle", "phase", "status"], sample: "lead" },
      { key: "contact_name", label: "Ansprechpartner", hints: ["contact_name", "ansprechpartner", "kontakt"], sample: "Dr. Martin Hofmann" },
      { key: "contact_email", label: "E-Mail", hints: ["email", "e-mail", "mail"], sample: "info@hofmann-dental.de" },
      { key: "mrr", label: "MRR (€)", type: "number", hints: ["mrr", "umsatz", "wert"], sample: "497" },
      { key: "ort", label: "Ort", hints: ["ort", "stadt", "city", "standort"], sample: "Hannover" },
      { key: "contact_phone", label: "Telefon", hints: ["telefon", "telefonnummer", "phone", "tel", "mobil"], sample: "+49 511 123456" },
      { key: "owner", label: "Zuständige:r Mitarbeiter:in", hints: ["zuständig", "zustaendig", "mitarbeiter", "owner", "verantwortlich", "betreuer"], sample: "Ricardo Serrano" },
      { key: "country", label: "Land/Region", hints: ["land", "region", "country"], sample: "Germany" },
      { key: "since", label: "Erstellungsdatum", type: "date", hints: ["erstellung", "erstellt", "created", "seit", "anlage"], sample: "2026-06-16" },
      { key: "last_activity_at", label: "Letzte Aktivität", type: "datetime", hints: ["letzte aktivität", "aktivität", "aktivitaet", "last activity", "letzter kontakt"], sample: "2026-06-15 16:20" },
      { key: "external_id", label: "Datensatz-ID (HubSpot)", hints: ["datensatz-id", "datensatz id", "datensatz", "record id", "hubspot", "externe id"], sample: "433011660017" },
    ],
    dedupe: [
      { key: "name", label: "Firmenname" },
      { key: "external_id", label: "Datensatz-ID (HubSpot)" },
      { key: "contact_email", label: "E-Mail" },
      ID_DEDUPE,
      NO_DEDUPE,
    ],
  },
  {
    key: "candidates",
    label: "Kandidaten",
    group: "Datensätze",
    description: "Personen der Recruiting-Pipeline.",
    table: "candidates",
    fields: [
      { key: "name", label: "Name", required: true, hints: ["name", "kandidat", "person"], sample: "Anna Decker" },
      { key: "role", label: "Position / Rolle", hints: ["role", "position", "rolle", "beruf", "titel"], sample: "Pflegefachkraft" },
      { key: "email", label: "E-Mail", hints: ["email", "e-mail", "mail"], sample: "anna.decker@example.com" },
      { key: "phone", label: "Telefon", hints: ["phone", "telefon", "tel", "mobil"], sample: "+49 511 123456" },
      { key: "mandate_account", label: "Mandat / Account", hints: ["mandate", "mandat", "account", "kunde"], sample: "CareHaus Senioren" },
      { key: "stage", label: "Phase (neu/screening/interview/angebot/platziert)", hints: ["stage", "phase", "status"], sample: "neu" },
      { key: "source", label: "Quelle", hints: ["source", "quelle", "herkunft"], sample: "LinkedIn" },
    ],
    dedupe: [{ key: "email", label: "E-Mail" }, { key: "name", label: "Name" }, ID_DEDUPE, NO_DEDUPE],
  },
  {
    key: "account_contacts",
    label: "Ansprechpartner",
    group: "Datensätze",
    description: "Kontaktpersonen, einem Account zugeordnet.",
    table: "account_contacts",
    parentRef: { field: "account", table: "accounts", matchColumns: ["name"], setId: "account_id" },
    fields: [
      ACCOUNT_FIELD,
      { key: "name", label: "Name", required: true, hints: ["name", "kontakt", "ansprechpartner", "person"], sample: "Sabine Krause" },
      { key: "role", label: "Position / Rolle", hints: ["role", "position", "rolle", "funktion", "titel"], sample: "Praxismanagerin" },
      { key: "email", label: "E-Mail", hints: ["email", "e-mail", "mail"], sample: "s.krause@hofmann-dental.de" },
      { key: "phone", label: "Telefon", hints: ["phone", "telefon", "tel", "mobil"], sample: "+49 511 123457" },
    ],
    dedupe: [{ key: "email", label: "E-Mail" }, ID_DEDUPE, NO_DEDUPE],
  },
  {
    key: "ki_projects",
    label: "Projekte · KI & Telefonassistenz",
    group: "Datensätze",
    description: "KI-Projekte mit Produkt, Status und MRR.",
    table: "ki_projects",
    fields: [
      { key: "account_name", label: "Account (Firmenname)", required: true, hints: ["account", "firma", "unternehmen", "kunde"], sample: "Hofmann Dental MVZ" },
      { key: "product", label: "Produkt", hints: ["product", "produkt"], sample: "Autonome KI-Agenten" },
      { key: "segment", label: "Segment", hints: ["segment"], sample: "Praxen" },
      { key: "status", label: "Status (onboarding/live/…)", hints: ["status", "phase"], sample: "onboarding" },
      { key: "mrr", label: "MRR (€)", type: "number", hints: ["mrr", "umsatz"], sample: "497" },
      { key: "go_live", label: "Go-Live (Datum)", type: "date", hints: ["go_live", "golive", "live", "datum", "start"], sample: "2026-07-01" },
      { key: "health", label: "Health (gut/neutral/kritisch)", hints: ["health"], sample: "neutral" },
    ],
    dedupe: [ID_DEDUPE, NO_DEDUPE],
  },
  {
    key: "recruiting_mandates",
    label: "Projekte · Personalvermittlung",
    group: "Datensätze",
    description: "Recruiting-Mandate mit Rolle, Stellen und Honorar.",
    table: "recruiting_mandates",
    fields: [
      { key: "account_name", label: "Account (Firmenname)", required: true, hints: ["account", "firma", "unternehmen", "kunde"], sample: "CareHaus Senioren" },
      { key: "role", label: "Zu besetzende Rolle", required: true, hints: ["role", "rolle", "position", "stelle"], sample: "Pflegefachkraft" },
      { key: "positions", label: "Anzahl Stellen", type: "number", hints: ["positions", "stellen", "anzahl"], sample: "3" },
      { key: "status", label: "Status (offen/laufend/besetzt)", hints: ["status", "phase"], sample: "offen" },
      { key: "fee", label: "Honorar (€)", type: "number", hints: ["fee", "honorar", "fixum", "preis"], sample: "9999" },
      { key: "deadline", label: "Deadline (Datum)", type: "date", hints: ["deadline", "frist", "datum"], sample: "2026-08-15" },
    ],
    dedupe: [ID_DEDUPE, NO_DEDUPE],
  },

  // ───────────────────────── Aktivitäten (zu Kandidat:innen) ─────────────────────────
  {
    key: "candidate_notes",
    label: "Notizen (Kandidat:innen)",
    group: "Aktivitäten",
    description: "Notiztext, zugeordnet über E-Mail oder Name.",
    table: "candidate_notes",
    fixed: { kind: "note" },
    parentRef: { field: "candidate", table: "candidates", matchColumns: ["email", "name"], setId: "candidate_id" },
    fields: [
      CANDIDATE_FIELD,
      { key: "body", label: "Notiztext", required: true, hints: ["note", "notiz", "text", "body"], sample: "Erstgespräch sehr positiv." },
      ACTIVITY_DATE,
    ],
    dedupe: [NO_DEDUPE, ID_DEDUPE],
  },
  {
    key: "candidate_calls",
    label: "Anrufe (Kandidat:innen)",
    group: "Aktivitäten",
    description: "Gesprächsnotiz + Aktivitätsdatum.",
    table: "candidate_notes",
    fixed: { kind: "call" },
    parentRef: { field: "candidate", table: "candidates", matchColumns: ["email", "name"], setId: "candidate_id" },
    fields: [
      CANDIDATE_FIELD,
      { key: "body", label: "Gesprächsnotiz", required: true, hints: ["call", "anruf", "gespräch", "notiz", "text", "body"], sample: "Telefonisch erreicht, Interesse bestätigt." },
      ACTIVITY_DATE,
    ],
    dedupe: [NO_DEDUPE, ID_DEDUPE],
  },
  {
    key: "candidate_meetings",
    label: "Meetings (Kandidat:innen)",
    group: "Aktivitäten",
    description: "Meeting-Beschreibung + Startzeit.",
    table: "candidate_notes",
    fixed: { kind: "meeting" },
    parentRef: { field: "candidate", table: "candidates", matchColumns: ["email", "name"], setId: "candidate_id" },
    fields: [
      CANDIDATE_FIELD,
      { key: "body", label: "Meeting-Beschreibung", required: true, hints: ["meeting", "beschreibung", "text", "body"], sample: "Vor-Ort-Interview, 45 Min." },
      { key: "created_at", label: "Startzeit / Aktivitätsdatum", type: "datetime", hints: ["start", "startzeit", "datum", "date", "zeit"], sample: "2026-06-18 11:00" },
    ],
    dedupe: [NO_DEDUPE, ID_DEDUPE],
  },
  {
    key: "candidate_tasks",
    label: "Aufgaben (Kandidat:innen)",
    group: "Aktivitäten",
    description: "Aufgabentitel + Fälligkeitsdatum.",
    table: "crm_tasks",
    fixed: { related_type: "candidate" },
    parentRef: { field: "candidate", table: "candidates", matchColumns: ["email", "name"], setId: "related_id", setLabel: "related_label" },
    fields: [
      CANDIDATE_FIELD,
      { key: "title", label: "Aufgabentitel", required: true, hints: ["task", "aufgabe", "titel", "title"], sample: "Interview vorbereiten" },
      { key: "due_date", label: "Fälligkeitsdatum", type: "date", hints: ["due", "fällig", "deadline", "datum", "date"], sample: "2026-06-20" },
    ],
    dedupe: [NO_DEDUPE, ID_DEDUPE],
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
  for (const c of cands) {
    const i = hdr.indexOf(c);
    if (i >= 0) return i;
  }
  for (const c of cands) {
    const i = hdr.findIndex((h) => h.length > 1 && (h.includes(c) || c.includes(h)));
    if (i >= 0) return i;
  }
  return -1;
}

/** Baut eine Beispiel-CSV (Semikolon-getrennt) für ein Objekt. */
export function sampleCsv(obj: ImportObject): string {
  const headers = obj.fields.map((f) => f.label);
  const row = obj.fields.map((f) => f.sample ?? "");
  const esc = (v: string) => (/[";\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
  return [headers, row].map((r) => r.map(esc).join(";")).join("\r\n") + "\r\n";
}
