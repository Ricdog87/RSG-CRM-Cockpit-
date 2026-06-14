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

/** Leere/sichere Defaults, falls eine View für die:den Partner:in (noch) keine Zeile liefert. */
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
function buildVerlauf(
  rows: { period: string; amount: number }[]
): BestandPoint[] {
  const now = new Date();
  const points: BestandPoint[] = [];
  const byPeriod = new Map<string, number>();
  for (const r of rows) {
    byPeriod.set(r.period, (byPeriod.get(r.period) ?? 0) + Number(r.amount));
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

/** Ordnet anhand der eigenen Kennzahlen die aktuelle + nächste Karrierestufe zu. */
function resolveCareer(
  levels: CareerLevel[],
  ownActive: number,
  directCount: number
): CareerState {
  const sorted = [...levels].sort((a, b) => a.level - b.level);
  let current = sorted[0];
  for (const lvl of sorted) {
    if (ownActive >= lvl.min_own_active && directCount >= lvl.min_active_directs) {
      current = lvl;
    }
  }
  const next = sorted.find((l) => l.level === current.level + 1) ?? null;
  return { current, next, own_active: ownActive, active_direct_count: directCount };
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
    // Middleware fängt das eigentlich ab; defensiver Fallback.
    throw new Error("Keine aktive Partner-Session.");
  }

  // Eigene partners-Zeile über auth_user_id mappen.
  const { data: partnerRow, error: partnerErr } = await supabase
    .from("partners")
    .select("id, display_name, email")
    .eq("auth_user_id", user.id)
    .single();

  if (partnerErr || !partnerRow) {
    throw new Error(
      "Für diese:n Nutzer:in ist kein Partner-Profil hinterlegt (partners.auth_user_id)."
    );
  }

  const partnerId = partnerRow.id as string;

  const [
    bestandRes,
    earningsRes,
    eligibilityRes,
    careerLevelsRes,
    leaderboardRes,
    dealsRes,
    downlineRes,
    commissionsRes,
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
      .select("partner_id, own_active, active_direct_count, min_active_directs")
      .eq("partner_id", partnerId)
      .maybeSingle(),
    // Karrierestufen (Stammdaten)
    supabase
      .from("career_levels")
      .select("level, name, min_active_directs, min_own_active")
      .order("level", { ascending: true }),
    // Leaderboard
    supabase
      .from("v_leaderboard")
      .select("rank, partner_id, display_name, mrr_bestand, aktive_kunden")
      .order("rank", { ascending: true })
      .limit(10),
    // Pipeline: deals join customers, products
    supabase
      .from("deals")
      .select(
        "id, stage, mrr_value, probability, expected_close, updated_at, customers(name), products(name)"
      )
      .eq("partner_id", partnerId)
      .order("updated_at", { ascending: false }),
    // Team/Downline
    supabase
      .from("partners")
      .select(
        "id, display_name, aktive_kunden, mrr_bestand, is_active, joined_at"
      )
      .eq("upline_id", partnerId)
      .order("mrr_bestand", { ascending: false }),
    // Bestands-Wachstumskurve: commissions, closer_recurring je Periode
    supabase
      .from("commissions")
      .select("period, amount")
      .eq("partner_id", partnerId)
      .eq("ctype", "closer_recurring"),
  ]);

  const bestand: PartnerBestand =
    (bestandRes.data as PartnerBestand | null) ?? emptyBestand(partnerId);
  const earnings: PartnerEarnings =
    (earningsRes.data as PartnerEarnings | null) ?? emptyEarnings(partnerId);

  const override: OverrideEligibility =
    (eligibilityRes.data as OverrideEligibility | null) ?? {
      partner_id: partnerId,
      own_active: bestand.aktive_kunden,
      active_direct_count: 0,
      min_active_directs: 0,
    };

  const careerLevels = (careerLevelsRes.data as CareerLevel[] | null) ?? [];
  const career = resolveCareer(
    careerLevels,
    override.own_active,
    override.active_direct_count
  );

  const leaderboard: LeaderboardRow[] = (
    (leaderboardRes.data as LeaderboardRow[] | null) ?? []
  ).map((row) => ({ ...row, is_self: row.partner_id === partnerId }));

  const pipeline: Deal[] = (
    (dealsRes.data as Array<Record<string, unknown>> | null) ?? []
  ).map((row) => ({
    id: String(row.id),
    customer_name:
      (row.customers as { name?: string } | null)?.name ?? "Unbenannt",
    product_name:
      (row.products as { name?: string } | null)?.name ?? "Produkt",
    stage: (row.stage as Deal["stage"]) ?? "neu",
    mrr_value: Number(row.mrr_value ?? 0),
    probability: Number(row.probability ?? 0),
    expected_close: (row.expected_close as string | null) ?? null,
    updated_at: String(row.updated_at ?? ""),
  }));

  const downline: DownlinePartner[] = (
    (downlineRes.data as Array<Record<string, unknown>> | null) ?? []
  ).map((row) => ({
    partner_id: String(row.id),
    display_name: String(row.display_name ?? "Partner:in"),
    aktive_kunden: Number(row.aktive_kunden ?? 0),
    mrr_bestand: Number(row.mrr_bestand ?? 0),
    is_active: Boolean(row.is_active),
    joined_at: String(row.joined_at ?? ""),
  }));

  const bestandsverlauf = buildVerlauf(
    ((commissionsRes.data as Array<{ period: string; amount: number }> | null) ??
      []).map((r) => ({ period: r.period, amount: Number(r.amount) }))
  );

  return {
    partner: {
      id: partnerId,
      display_name: String(partnerRow.display_name ?? "Partner:in"),
      email: String(partnerRow.email ?? user.email ?? ""),
    },
    bestand,
    earnings,
    bestandsverlauf,
    pipeline,
    career,
    override,
    leaderboard,
    downline,
  };
}
