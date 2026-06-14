import "server-only";
import { createClient } from "@/lib/supabase/server";
import { useMockData } from "@/lib/env";
import { mockCockpitData } from "@/lib/mock";
import type {
  BestandPoint,
  CareerLevel,
  CareerState,
  CockpitData,
  Deal,
  DownlinePartner,
  LeaderboardRow,
  OverrideEligibility,
  PartnerBestand,
  PartnerEarnings,
} from "@/lib/types";

const MONTH_LABELS = [
  "Jan",
  "Feb",
  "Mär",
  "Apr",
  "Mai",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Okt",
  "Nov",
  "Dez",
];

/**
 * Stufenplan laut Provisionsordnung §2 (rechtsverbindliche Anlage 1).
 * Dient als Fallback, falls `career_levels` (noch) leer ist — die RSG-Migration
 * spiegelt die Stufen später in die Tabelle. Override-Ebenen: 0/1/2/2.
 */
const DEFAULT_CAREER_LADDER: CareerLevel[] = [
  { level: 1, name: "RSG Partner", override_levels: 0 },
  { level: 2, name: "Senior Partner", override_levels: 1 },
  { level: 3, name: "Director", override_levels: 2 },
  { level: 4, name: "Equity Circle", override_levels: 2 },
];

function emptyBestand(partnerId: string): PartnerBestand {
  return {
    partner_id: partnerId,
    aktive_kunden: 0,
    mrr_bestand: 0,
    monatl_bestandsprovision: 0,
  };
}

function emptyEarnings(partnerId: string): PartnerEarnings {
  return {
    partner_id: partnerId,
    offen_freigegeben: 0,
    ausgezahlt: 0,
    in_stornoreserve: 0,
    override_pausiert: 0,
  };
}

/** Baut die 12-Monats-Achse (gefüllt mit 0) und mappt die Provisionen ein. */
function buildVerlauf(rows: { period: string; amount: number }[]): BestandPoint[] {
  const now = new Date();
  const points: BestandPoint[] = [];
  const byPeriod = new Map<string, number>();
  for (const r of rows) {
    // period kann ein Datum oder ein YYYY-MM-String sein → auf YYYY-MM normalisieren.
    const key = String(r.period).slice(0, 7);
    byPeriod.set(key, (byPeriod.get(key) ?? 0) + Number(r.amount));
  }
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const period = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    points.push({
      period,
      label: MONTH_LABELS[d.getMonth()],
      amount: byPeriod.get(period) ?? 0,
    });
  }
  return points;
}

/**
 * Bestimmt aktuelle + nächste Stufe anhand der level_id aus
 * v_override_eligibility (der Aufstieg selbst wird struktur-/leistungsbasiert
 * serverseitig gebucht, §2 Provisionsordnung).
 */
function resolveCareer(
  levels: CareerLevel[],
  override: OverrideEligibility
): CareerState {
  const ladder =
    levels.length > 0
      ? [...levels].sort((a, b) => a.level - b.level)
      : DEFAULT_CAREER_LADDER;

  const current =
    ladder.find((l) => l.level === override.level_id) ?? ladder[0];
  const idx = ladder.findIndex((l) => l.level === current.level);
  const next = ladder[idx + 1] ?? null;

  return {
    current,
    next,
    active_direct_count: override.active_direct_count,
    min_active_directs: override.min_active_directs,
  };
}

/**
 * Lädt alle Cockpit-Daten für die:den eingeloggte:n Partner:in.
 * Liest ausschließlich aus den vorgegebenen Views/Tabellen via ANON-Key +
 * User-Session; RLS schränkt automatisch auf eigene Daten + Downline ein.
 */
export async function getCockpitData(): Promise<CockpitData> {
  if (useMockData) {
    return mockCockpitData;
  }

  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("Keine aktive Partner-Session.");
  }

  // Eigene partners-Zeile über auth_user_id mappen.
  const { data: partnerRow, error: partnerErr } = await supabase
    .from("partners")
    .select("id, full_name, email")
    .eq("auth_user_id", user.id)
    .single();

  if (partnerErr || !partnerRow) {
    throw new Error(
      "Für diese:n Nutzer:in ist kein Partner-Profil hinterlegt (partners.auth_user_id)."
    );
  }

  const partnerId = partnerRow.id as string;

  // Grenzen des laufenden Monats für die KPI "Provision aktueller Monat".
  const now = new Date();
  const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
  const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const monthEnd = `${nextMonth.getFullYear()}-${String(nextMonth.getMonth() + 1).padStart(2, "0")}-01`;

  const [
    bestandRes,
    earningsRes,
    eligibilityRes,
    careerLevelsRes,
    leaderboardRes,
    dealsRes,
    downlineRes,
    verlaufRes,
    monatProvRes,
  ] = await Promise.all([
    // KPIs & Bestand
    supabase
      .from("v_partner_bestand")
      .select("partner_id, aktive_kunden, mrr_bestand, monatl_bestandsprovision")
      .eq("partner_id", partnerId)
      .maybeSingle(),
    // Provisionsübersicht
    supabase
      .from("v_partner_earnings")
      .select(
        "partner_id, offen_freigegeben, ausgezahlt, in_stornoreserve, override_pausiert"
      )
      .eq("partner_id", partnerId)
      .maybeSingle(),
    // Override-Eligibility
    supabase
      .from("v_override_eligibility")
      .select(
        "partner_id, level_id, override_levels, min_active_directs, active_direct_count, own_active"
      )
      .eq("partner_id", partnerId)
      .maybeSingle(),
    // Karrierestufen (Stammdaten) – defensiv, Fallback auf Default-Leiter.
    supabase.from("career_levels").select("*"),
    // Leaderboard (kein rank in der View → Sortierung nach Bestand)
    supabase
      .from("v_leaderboard")
      .select("partner_id, full_name, level_id, mrr_bestand, provision_90d")
      .order("mrr_bestand", { ascending: false })
      .limit(10),
    // Pipeline: deals join customers, products
    supabase
      .from("deals")
      .select(
        "id, stage, mrr_value, probability, expected_close, updated_at, customers(name), products(name)"
      )
      .eq("partner_id", partnerId)
      .order("updated_at", { ascending: false }),
    // Team/Downline: direkte Partner:innen
    supabase
      .from("partners")
      .select("id, full_name, is_active")
      .eq("upline_id", partnerId),
    // Bestands-Wachstumskurve: commissions, closer_recurring je Periode
    supabase
      .from("commissions")
      .select("period, amount")
      .eq("partner_id", partnerId)
      .eq("ctype", "closer_recurring"),
    // KPI Provision laufender Monat: commissions, Status offen/freigegeben
    supabase
      .from("commissions")
      .select("amount")
      .eq("partner_id", partnerId)
      .in("status", ["offen", "freigegeben"])
      .gte("period", monthStart)
      .lt("period", monthEnd),
  ]);

  const bestand: PartnerBestand =
    (bestandRes.data as PartnerBestand | null) ?? emptyBestand(partnerId);
  const earnings: PartnerEarnings =
    (earningsRes.data as PartnerEarnings | null) ?? emptyEarnings(partnerId);

  const eligibility = eligibilityRes.data as Partial<OverrideEligibility> | null;
  const override: OverrideEligibility = {
    partner_id: partnerId,
    level_id: eligibility?.level_id ?? null,
    override_levels: Number(eligibility?.override_levels ?? 0),
    min_active_directs: Number(eligibility?.min_active_directs ?? 0),
    active_direct_count: Number(eligibility?.active_direct_count ?? 0),
    own_active: Number(eligibility?.own_active ?? bestand.aktive_kunden),
  };

  // career_levels defensiv mappen; ohne Treffer greift die Default-Leiter (§2).
  const careerLevels: CareerLevel[] = (
    (careerLevelsRes.data as Array<Record<string, unknown>> | null) ?? []
  )
    .map((row) => ({
      level: Number(row.level ?? row.id ?? 0),
      name: String(row.name ?? row.title ?? "Stufe"),
      override_levels: Number(row.override_levels ?? 0),
    }))
    .filter((l) => l.level > 0);

  const career = resolveCareer(careerLevels, override);

  const leaderboard: LeaderboardRow[] = (
    (leaderboardRes.data as Array<Record<string, unknown>> | null) ?? []
  ).map((row, i) => ({
    rank: i + 1,
    partner_id: String(row.partner_id),
    full_name: String(row.full_name ?? "Partner:in"),
    level_id: row.level_id != null ? Number(row.level_id) : null,
    mrr_bestand: Number(row.mrr_bestand ?? 0),
    provision_90d: Number(row.provision_90d ?? 0),
    is_self: String(row.partner_id) === partnerId,
  }));

  const pipeline: Deal[] = (
    (dealsRes.data as Array<Record<string, unknown>> | null) ?? []
  ).map((row) => ({
    id: String(row.id),
    customer_name:
      (row.customers as { name?: string } | null)?.name ?? "Unbenannt",
    product_name: (row.products as { name?: string } | null)?.name ?? "Produkt",
    stage: (row.stage as Deal["stage"]) ?? "neu",
    mrr_value: Number(row.mrr_value ?? 0),
    probability: Number(row.probability ?? 0),
    expected_close: (row.expected_close as string | null) ?? null,
    updated_at: String(row.updated_at ?? ""),
  }));

  // Downline: Bestand der direkten Partner:innen via v_partner_bestand zumischen.
  const directRows =
    (downlineRes.data as Array<Record<string, unknown>> | null) ?? [];
  const directIds = directRows.map((r) => String(r.id));
  let bestandByPartner = new Map<string, { aktive_kunden: number; mrr_bestand: number }>();
  if (directIds.length > 0) {
    const { data: teamBestand } = await supabase
      .from("v_partner_bestand")
      .select("partner_id, aktive_kunden, mrr_bestand")
      .in("partner_id", directIds);
    bestandByPartner = new Map(
      ((teamBestand as Array<Record<string, unknown>> | null) ?? []).map((r) => [
        String(r.partner_id),
        {
          aktive_kunden: Number(r.aktive_kunden ?? 0),
          mrr_bestand: Number(r.mrr_bestand ?? 0),
        },
      ])
    );
  }
  const downline: DownlinePartner[] = directRows
    .map((row) => {
      const b = bestandByPartner.get(String(row.id));
      return {
        partner_id: String(row.id),
        full_name: String(row.full_name ?? "Partner:in"),
        aktive_kunden: b?.aktive_kunden ?? 0,
        mrr_bestand: b?.mrr_bestand ?? 0,
        is_active: Boolean(row.is_active),
      };
    })
    .sort((a, b) => b.mrr_bestand - a.mrr_bestand);

  const bestandsverlauf = buildVerlauf(
    ((verlaufRes.data as Array<{ period: string; amount: number }> | null) ?? []).map(
      (r) => ({ period: r.period, amount: Number(r.amount) })
    )
  );

  const provisionAktuellerMonat = (
    (monatProvRes.data as Array<{ amount: number }> | null) ?? []
  ).reduce((sum, r) => sum + Number(r.amount ?? 0), 0);

  return {
    partner: {
      id: partnerId,
      display_name: String(partnerRow.full_name ?? user.email ?? "Partner:in"),
      email: String(partnerRow.email ?? user.email ?? ""),
    },
    bestand,
    earnings,
    provisionAktuellerMonat,
    bestandsverlauf,
    pipeline,
    career,
    override,
    leaderboard,
    downline,
  };
}
