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
