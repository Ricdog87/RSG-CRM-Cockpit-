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

// Stufenplan laut Provisionsordnung §2 (Override-Ebenen je Stufe).
const careerLevels: CareerLevel[] = [
  { level: 1, name: "RSG Partner", override_levels: 0 },
  { level: 2, name: "Senior Partner", override_levels: 1 },
  { level: 3, name: "Director", override_levels: 2 },
  { level: 4, name: "Equity Circle", override_levels: 2 },
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
  890, 980, 1060, 1140, 1220, 1310, 1400, 1500, 1600, 1690, 1770, 1843,
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
    full_name: "Anna Decker",
    aktive_kunden: 22,
    mrr_bestand: 1840,
    is_active: true,
  },
  {
    partner_id: "p-jonas",
    full_name: "Jonas Pfeiffer",
    aktive_kunden: 9,
    mrr_bestand: 720,
    is_active: true,
  },
  {
    partner_id: "p-mira",
    full_name: "Mira Sahin",
    aktive_kunden: 3,
    mrr_bestand: 210,
    is_active: false,
  },
];

const leaderboard: LeaderboardRow[] = [
  {
    rank: 1,
    partner_id: "p-lead-1",
    full_name: "Sandra König",
    level_id: 4,
    mrr_bestand: 18900,
    provision_90d: 9860,
  },
  {
    rank: 2,
    partner_id: "p-lead-2",
    full_name: "Tobias Wenzel",
    level_id: 3,
    mrr_bestand: 13200,
    provision_90d: 6740,
  },
  {
    rank: 3,
    partner_id: "p-self",
    full_name: "Du",
    level_id: 2,
    mrr_bestand: 10840,
    provision_90d: 3520,
    is_self: true,
  },
  {
    rank: 4,
    partner_id: "p-lead-4",
    full_name: "Lena Fischer",
    level_id: 3,
    mrr_bestand: 8600,
    provision_90d: 2980,
  },
  {
    rank: 5,
    partner_id: "p-lead-5",
    full_name: "Marco Albrecht",
    level_id: 2,
    mrr_bestand: 6300,
    provision_90d: 2540,
  },
];

const own_active = 24; // eigene aktive Bestandskund:innen (KI-Verträge)
// Senior Partner: Override-Ebene 1; Mindestaktivität ≥3 aktive Direkte (§6).
// Aktuell nur 2 aktiv ⇒ Override ruht/„pausiert".
const active_direct_count = 2; // Anna + Jonas aktiv, Mira inaktiv
const min_active_directs = 3;

export const mockCockpitData: CockpitData = {
  partner: {
    id: "p-self",
    display_name: "Demo Partner",
    email: "partner@recruiting-sg.de",
  },
  bestand: {
    partner_id: "p-self",
    aktive_kunden: own_active,
    mrr_bestand: 10840, // zugrunde liegender monatlicher Kundenumsatz (MRR)
    monatl_bestandsprovision: 1843, // ≈ 17 % MRR (Provisionsordnung §3.1)
  },
  earnings: {
    partner_id: "p-self",
    offen_freigegeben: 1180,
    ausgezahlt: 21450,
    in_stornoreserve: 640,
    // > 0 ⇒ Override pausiert (es fehlt ein aktiver Direktpartner, §6(2)).
    override_pausiert: 480,
  },
  provisionAktuellerMonat: 2310, // Bestand + Neugeschäft (Setup) im Monat
  bestandsverlauf,
  pipeline,
  career: {
    current: careerLevels[1], // Senior Partner
    next: careerLevels[2], // Director
    active_direct_count,
    min_active_directs,
  },
  override: {
    partner_id: "p-self",
    level_id: 2,
    override_levels: 1,
    min_active_directs,
    active_direct_count,
    own_active,
  },
  leaderboard,
  downline,
};

export { careerLevels };
