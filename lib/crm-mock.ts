import type {
  Account,
  Candidate,
  KiProject,
  Opportunity,
  RecruitingMandate,
  Segment,
} from "@/lib/crm-types";

/**
 * Mock-Datensatz für das RSG-CRM. Realistisch über beide Geschäftslinien
 * gestreut. Greift, solange die CRM-Tabellen in Supabase fehlen.
 */

export const segments: Segment[] = [
  {
    id: "s-handwerk",
    name: "Handwerk & Bau",
    description: "Betriebe mit hohem Anrufaufkommen und Terminkoordination.",
    accounts: 14,
    mrr: 5980,
    top_product: "Autonome KI-Agenten",
  },
  {
    id: "s-gesundheit",
    name: "Gesundheit & Praxen",
    description: "Arzt- und Zahnarztpraxen, Pflege, MVZ – Entlastung der Rezeption.",
    accounts: 11,
    mrr: 5210,
    top_product: "Autonome KI-Agenten",
  },
  {
    id: "s-kanzlei",
    name: "Kanzleien & Beratung",
    description: "Steuer-, Rechts- und Unternehmensberatung – Erreichbarkeit & Triage.",
    accounts: 8,
    mrr: 3120,
    top_product: "Voice-Agenten",
  },
  {
    id: "s-gastro",
    name: "Gastro & Retail",
    description: "Reservierungen, Bestellannahme, wiederkehrende Standardanfragen.",
    accounts: 9,
    mrr: 2140,
    top_product: "Automatische Workflows",
  },
  {
    id: "s-automotive",
    name: "Automotive & KFZ",
    description: "Autohäuser und Werkstätten – Serviceannahme und Rückrufe.",
    accounts: 6,
    mrr: 3360,
    top_product: "Voice-Agenten",
  },
];

export const accounts: Account[] = [
  { id: "a-1", name: "Hofmann Dental MVZ", branche: "Gesundheit", segment: "Gesundheit & Praxen", line: "ki", lifecycle: "bestand", contact_name: "Dr. Petra Hofmann", contact_email: "p.hofmann@hofmann-dental.de", mrr: 499, ort: "Mainz", since: "2025-01-12" },
  { id: "a-2", name: "Logistik Brendel GmbH", branche: "Logistik", segment: "Handwerk & Bau", line: "ki", lifecycle: "bestand", contact_name: "Marco Brendel", contact_email: "m.brendel@brendel-log.de", mrr: 1200, ort: "Frankfurt", since: "2025-03-04" },
  { id: "a-3", name: "Kanzlei Vogt & Partner", branche: "Recht", segment: "Kanzleien & Beratung", line: "ki", lifecycle: "bestand", contact_name: "RA Julia Vogt", contact_email: "vogt@vogt-partner.de", mrr: 499, ort: "Wiesbaden", since: "2024-11-20" },
  { id: "a-4", name: "Autohaus Petersen", branche: "Automotive", segment: "Automotive & KFZ", line: "ki", lifecycle: "bestand", contact_name: "Sven Petersen", contact_email: "s.petersen@ah-petersen.de", mrr: 1200, ort: "Darmstadt", since: "2025-04-09" },
  { id: "a-5", name: "Pflegedienst Aurum", branche: "Pflege", segment: "Gesundheit & Praxen", line: "ki", lifecycle: "kunde", contact_name: "Sabine Reichelt", contact_email: "leitung@pflege-aurum.de", mrr: 499, ort: "Offenbach", since: "2026-05-28" },
  { id: "a-6", name: "Elektro Wagner", branche: "Handwerk", segment: "Handwerk & Bau", line: "ki", lifecycle: "bestand", contact_name: "Thomas Wagner", contact_email: "info@elektro-wagner.de", mrr: 199, ort: "Rüsselsheim", since: "2025-07-15" },
  { id: "a-7", name: "Gastro Lindblatt", branche: "Gastronomie", segment: "Gastro & Retail", line: "ki", lifecycle: "kunde", contact_name: "Nina Lindblatt", contact_email: "n.lindblatt@lindblatt.de", mrr: 499, ort: "Mainz", since: "2026-02-10" },
  { id: "a-8", name: "Stadtwerke Region Süd", branche: "Energie", segment: "Kanzleien & Beratung", line: "ki", lifecycle: "opportunity", contact_name: "Dr. Klaus Memminger", contact_email: "k.memminger@sw-sued.de", mrr: 0, ort: "Heidelberg", since: "2026-06-01" },
  { id: "a-9", name: "Möbel Hartwig KG", branche: "Handel", segment: "Gastro & Retail", line: "recruiting", lifecycle: "kunde", contact_name: "Andrea Hartwig", contact_email: "a.hartwig@moebel-hartwig.de", mrr: 0, ort: "Aschaffenburg", since: "2026-03-22" },
  { id: "a-10", name: "TechnoFlex Engineering", branche: "Maschinenbau", segment: "Handwerk & Bau", line: "recruiting", lifecycle: "kunde", contact_name: "Dipl.-Ing. Ralf Stein", contact_email: "r.stein@technoflex.de", mrr: 0, ort: "Hanau", since: "2026-04-15" },
  { id: "a-11", name: "CareHaus Senioren", branche: "Pflege", segment: "Gesundheit & Praxen", line: "recruiting", lifecycle: "opportunity", contact_name: "Markus Demir", contact_email: "m.demir@carehaus.de", mrr: 0, ort: "Mainz", since: "2026-06-05" },
  { id: "a-12", name: "Spedition Kaiser", branche: "Logistik", segment: "Handwerk & Bau", line: "recruiting", lifecycle: "lead", contact_name: "Frank Kaiser", contact_email: "f.kaiser@sped-kaiser.de", mrr: 0, ort: "Worms", since: "2026-06-10" },
];

export const opportunities: Opportunity[] = [
  { id: "o-1", account_name: "Stadtwerke Region Süd", line: "ki", title: "Voice-Agenten – Bürgertelefon", value: 797, value_type: "mrr", stage: "verhandlung", probability: 70, owner: "Demo Partner", expected_close: "2026-06-30" },
  { id: "o-2", account_name: "Bäckerei Kortmann GmbH", line: "ki", title: "Autonome KI-Agenten", value: 497, value_type: "mrr", stage: "angebot", probability: 55, owner: "Demo Partner", expected_close: "2026-07-08" },
  { id: "o-3", account_name: "Praxis Dr. Lindner", line: "ki", title: "Automatische Workflows – Rezeption", value: 297, value_type: "mrr", stage: "demo", probability: 40, owner: "Anna Decker", expected_close: "2026-07-14" },
  { id: "o-4", account_name: "Café Lichtblick", line: "ki", title: "candiq", value: 99, value_type: "mrr", stage: "qualifiziert", probability: 30, owner: "Demo Partner", expected_close: "2026-07-20" },
  { id: "o-5", account_name: "City Fitness Group", line: "ki", title: "Voice-Agenten – 3 Standorte", value: 797, value_type: "mrr", stage: "neu", probability: 15, owner: "Jonas Pfeiffer", expected_close: "2026-08-02" },
  { id: "o-6", account_name: "CareHaus Senioren", line: "recruiting", title: "3× Pflegefachkraft", value: 29997, value_type: "fixed", stage: "verhandlung", probability: 65, owner: "Demo Partner", expected_close: "2026-07-05" },
  { id: "o-7", account_name: "TechnoFlex Engineering", line: "recruiting", title: "2× CNC-Fachkraft", value: 19998, value_type: "fixed", stage: "angebot", probability: 50, owner: "Anna Decker", expected_close: "2026-07-12" },
  { id: "o-8", account_name: "Spedition Kaiser", line: "recruiting", title: "1× Disponent:in", value: 9999, value_type: "fixed", stage: "qualifiziert", probability: 35, owner: "Demo Partner", expected_close: "2026-07-25" },
  { id: "o-9", account_name: "Möbel Hartwig KG", line: "recruiting", title: "1× Verkäufer:in", value: 9999, value_type: "fixed", stage: "gewonnen", probability: 100, owner: "Demo Partner", expected_close: "2026-06-04" },
];

export const kiProjects: KiProject[] = [
  { id: "k-1", account_name: "Hofmann Dental MVZ", product: "Autonome KI-Agenten", segment: "Gesundheit & Praxen", status: "live", mrr: 497, go_live: "2025-01-20", health: "gut" },
  { id: "k-2", account_name: "Logistik Brendel GmbH", product: "Voice-Agenten", segment: "Handwerk & Bau", status: "optimierung", mrr: 797, go_live: "2025-03-12", health: "neutral" },
  { id: "k-3", account_name: "Kanzlei Vogt & Partner", product: "Autonome KI-Agenten", segment: "Kanzleien & Beratung", status: "live", mrr: 497, go_live: "2024-11-28", health: "gut" },
  { id: "k-4", account_name: "Autohaus Petersen", product: "Voice-Agenten", segment: "Automotive & KFZ", status: "live", mrr: 797, go_live: "2025-04-18", health: "gut" },
  { id: "k-5", account_name: "Pflegedienst Aurum", product: "Autonome KI-Agenten", segment: "Gesundheit & Praxen", status: "onboarding", mrr: 497, go_live: "2026-06-20", health: "neutral" },
  { id: "k-6", account_name: "Elektro Wagner", product: "Automatische Workflows", segment: "Handwerk & Bau", status: "live", mrr: 297, go_live: "2025-07-22", health: "gut" },
  { id: "k-7", account_name: "Gastro Lindblatt", product: "Autonome KI-Agenten", segment: "Gastro & Retail", status: "pausiert", mrr: 497, go_live: "2026-02-18", health: "risiko" },
];

export const mandates: RecruitingMandate[] = [
  { id: "m-1", account_name: "CareHaus Senioren", role: "Pflegefachkraft (m/w/d)", positions: 3, filled: 1, status: "interviews", fee: 9999, candidate_count: 7, deadline: "2026-07-15" },
  { id: "m-2", account_name: "TechnoFlex Engineering", role: "CNC-Fachkraft (m/w/d)", positions: 2, filled: 0, status: "in_arbeit", fee: 9999, candidate_count: 5, deadline: "2026-07-30" },
  { id: "m-3", account_name: "Möbel Hartwig KG", role: "Verkäufer:in Einrichtung", positions: 1, filled: 1, status: "besetzt", fee: 9999, candidate_count: 4, deadline: "2026-06-04" },
  { id: "m-4", account_name: "Spedition Kaiser", role: "Disponent:in Logistik", positions: 1, filled: 0, status: "offen", fee: 9999, candidate_count: 2, deadline: "2026-08-10" },
];

export const candidates: Candidate[] = [
  { id: "cd-1", name: "Lena Brandt", role: "Pflegefachkraft", mandate_account: "CareHaus Senioren", stage: "interview", source: "Indeed", updated_at: "2026-06-12" },
  { id: "cd-2", name: "Yusuf Demir", role: "Pflegefachkraft", mandate_account: "CareHaus Senioren", stage: "angebot", source: "Empfehlung", updated_at: "2026-06-13" },
  { id: "cd-3", name: "Sandra Lohse", role: "Pflegefachkraft", mandate_account: "CareHaus Senioren", stage: "platziert", source: "LinkedIn", updated_at: "2026-06-01" },
  { id: "cd-4", name: "Tobias Reimann", role: "CNC-Fachkraft", mandate_account: "TechnoFlex Engineering", stage: "screening", source: "StepStone", updated_at: "2026-06-11" },
  { id: "cd-5", name: "Aleksandar Petrov", role: "CNC-Fachkraft", mandate_account: "TechnoFlex Engineering", stage: "interview", source: "Aktive Ansprache", updated_at: "2026-06-12" },
  { id: "cd-6", name: "Mehmet Yıldız", role: "CNC-Fachkraft", mandate_account: "TechnoFlex Engineering", stage: "neu", source: "Indeed", updated_at: "2026-06-13" },
  { id: "cd-7", name: "Carolin Vetter", role: "Verkäufer:in", mandate_account: "Möbel Hartwig KG", stage: "platziert", source: "Empfehlung", updated_at: "2026-06-03" },
  { id: "cd-8", name: "Jan Hofer", role: "Disponent:in", mandate_account: "Spedition Kaiser", stage: "screening", source: "LinkedIn", updated_at: "2026-06-10" },
  { id: "cd-9", name: "Priya Nair", role: "Pflegefachkraft", mandate_account: "CareHaus Senioren", stage: "neu", source: "LinkedIn", updated_at: "2026-06-14" },
  { id: "cd-10", name: "Daniel Köhler", role: "CNC-Fachkraft", mandate_account: "TechnoFlex Engineering", stage: "abgelehnt", source: "StepStone", updated_at: "2026-06-08" },
];
