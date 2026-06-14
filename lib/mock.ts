import type {
  CareerLevel,
  CockpitData,
  Deal,
  DownlinePartner,
  LeaderboardRow,
} from "@/lib/types";

/**
 * Realistischer Demo-Datensatz. Wird genutzt, solange keine Supabase-ENV
 * gesetzt sind, damit Build & Vercel-Preview ohne DB-Zugang funktionieren.
 * Die Struktur entspricht 1:1 den echten Views.
 */

const careerLevels: CareerLevel[] = [
  { level: 1, name: "Partner", min_active_directs: 0, min_own_active: 0 },
  { level: 2, name: "Senior Partner", min_active_directs: 2, min_own_active: 15 },
  { level: 3, name: "Teamleiter", min_active_directs: 4, min_own_active: 30 },
  { level: 4, name: "Regionalleiter", min_active_directs: 8, min_own_active: 60 },
  { level: 5, name: "Direktor", min_active_directs: 15, min_own_active: 120 },
];

// Wachstumskurve: 12 Monate, monatliche Bestandsprovision (closer_recurring).
const monthLabels = [
  "Jul",
  "Aug",
  "Sep",
  "Okt",
  "Nov",
  "Dez",
  "Jan",
  "Feb",
  "Mär",
  "Apr",
  "Mai",
  "Jun",
];

const bestandsverlauf = [
  1280, 1410, 1530, 1675, 1740, 1880, 2010, 2120, 2260, 2380, 2510, 2680,
].map((amount, i) => {
  const monthIndex = (6 + i) % 12; // Start Juli 2025
  const year = 6 + i < 12 ? 2025 : 2026;
  const period = `${year}-${String(monthIndex + 1).padStart(2, "0")}`;
  return { period, label: monthLabels[i], amount };
});

const pipeline: Deal[] = [
  {
    id: "d1",
    customer_name: "Bäckerei Kortmann GmbH",
    product_name: "Gewerbe-Strom Flex",
    stage: "verhandlung",
    mrr_value: 89,
    probability: 75,
    expected_close: "2026-06-28",
    updated_at: "2026-06-12T09:20:00Z",
  },
  {
    id: "d2",
    customer_name: "Praxis Dr. Vogt",
    product_name: "Business-Internet 500",
    stage: "angebot",
    mrr_value: 64,
    probability: 55,
    expected_close: "2026-07-05",
    updated_at: "2026-06-11T14:00:00Z",
  },
  {
    id: "d3",
    customer_name: "Auto Reinhardt e.K.",
    product_name: "Flotten-Versicherung",
    stage: "qualifiziert",
    mrr_value: 142,
    probability: 35,
    expected_close: "2026-07-18",
    updated_at: "2026-06-10T08:45:00Z",
  },
  {
    id: "d4",
    customer_name: "Café Lichtblick",
    product_name: "Kartenzahlung Komplett",
    stage: "neu",
    mrr_value: 39,
    probability: 20,
    expected_close: "2026-07-22",
    updated_at: "2026-06-09T16:30:00Z",
  },
  {
    id: "d5",
    customer_name: "Schreinerei Bauch",
    product_name: "Gewerbe-Strom Flex",
    stage: "gewonnen",
    mrr_value: 76,
    probability: 100,
    expected_close: "2026-06-03",
    updated_at: "2026-06-03T10:15:00Z",
  },
];

const downline: DownlinePartner[] = [
  {
    partner_id: "p-anna",
    display_name: "Anna Decker",
    aktive_kunden: 22,
    mrr_bestand: 1840,
    is_active: true,
    joined_at: "2025-02-14",
  },
  {
    partner_id: "p-jonas",
    display_name: "Jonas Pfeiffer",
    aktive_kunden: 9,
    mrr_bestand: 720,
    is_active: true,
    joined_at: "2025-06-01",
  },
  {
    partner_id: "p-mira",
    display_name: "Mira Sahin",
    aktive_kunden: 3,
    mrr_bestand: 210,
    is_active: false,
    joined_at: "2026-01-20",
  },
];

const leaderboard: LeaderboardRow[] = [
  {
    rank: 1,
    partner_id: "p-lead-1",
    display_name: "Sandra König",
    mrr_bestand: 7420,
    aktive_kunden: 96,
  },
  {
    rank: 2,
    partner_id: "p-lead-2",
    display_name: "Tobias Wenzel",
    mrr_bestand: 5180,
    aktive_kunden: 71,
  },
  {
    rank: 3,
    partner_id: "p-self",
    display_name: "Du",
    mrr_bestand: 2680,
    aktive_kunden: 41,
    is_self: true,
  },
  {
    rank: 4,
    partner_id: "p-lead-4",
    display_name: "Lena Fischer",
    mrr_bestand: 2310,
    aktive_kunden: 35,
  },
  {
    rank: 5,
    partner_id: "p-lead-5",
    display_name: "Marco Albrecht",
    mrr_bestand: 1990,
    aktive_kunden: 28,
  },
];

const own_active = 41;
const active_direct_count = 2; // Anna + Jonas aktiv, Mira inaktiv

export const mockCockpitData: CockpitData = {
  partner: {
    id: "p-self",
    display_name: "Demo Partner",
    email: "partner@recruiting-sg.de",
  },
  bestand: {
    partner_id: "p-self",
    aktive_kunden: own_active,
    mrr_bestand: 2680,
    monatl_bestandsprovision: 2680,
  },
  earnings: {
    partner_id: "p-self",
    offen_freigegeben: 1240,
    ausgezahlt: 18650,
    in_stornoreserve: 430,
    // > 0 ⇒ Override pausiert (es fehlt ein aktiver Direktpartner für Stufe 3).
    override_pausiert: 320,
  },
  bestandsverlauf,
  pipeline,
  career: {
    current: careerLevels[1], // Senior Partner
    next: careerLevels[2], // Teamleiter
    own_active,
    active_direct_count,
  },
  override: {
    partner_id: "p-self",
    own_active,
    active_direct_count,
    min_active_directs: 4, // Stufe Teamleiter benötigt 4 aktive Direkte
  },
  leaderboard,
  downline,
};

export { careerLevels };
