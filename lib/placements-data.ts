import "server-only";
import { createClient } from "@/lib/supabase/server";
import { useMockData } from "@/lib/env";
import {
  placementSplitDate,
  placementGuaranteeUntil,
  type Placement,
  type PlacementStatus,
} from "@/lib/crm-types";

type Row = Record<string, unknown>;
const str = (v: unknown): string => (v == null ? "" : String(v));
const num = (v: unknown): number | undefined => (v == null ? undefined : Number(v));

function mapPlacement(r: Row): Placement {
  return {
    id: str(r.id),
    candidate_id: str(r.candidate_id) || undefined,
    mandate_id: str(r.mandate_id) || undefined,
    candidate_name: str(r.candidate_name) || "Kandidat:in",
    account_name: str(r.account_name),
    role: str(r.role),
    start_date: str(r.start_date) || undefined,
    agreed_fee: num(r.agreed_fee),
    guarantee_months: num(r.guarantee_months) ?? 6,
    status: (str(r.status) || "aktiv") as PlacementStatus,
    notes: str(r.notes) || undefined,
    created_at: str(r.created_at) || undefined,
  };
}

/** Alle Platzierungen (RLS: eigene + Downline). */
export async function getPlacements(): Promise<Placement[]> {
  if (useMockData) return [];
  try {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("placements")
      .select("*")
      .order("start_date", { ascending: true });
    if (error || !data) return [];
    return (data as Row[]).map(mapPlacement);
  } catch {
    return [];
  }
}

/** Platzierungen eines Mandats. */
export async function getPlacementsForMandate(mandateId: string): Promise<Placement[]> {
  if (useMockData) return [];
  try {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("placements")
      .select("*")
      .eq("mandate_id", mandateId)
      .order("start_date", { ascending: true });
    if (error || !data) return [];
    return (data as Row[]).map(mapPlacement);
  } catch {
    return [];
  }
}

export interface PlacementMilestone {
  placement: Placement;
  kind: "split" | "garantie";
  label: string;
  date: string;
  daysUntil: number;
  overdue: boolean;
}

function daysBetween(fromIso: string, toIso: string): number {
  const a = new Date(fromIso + "T00:00:00").getTime();
  const b = new Date(toIso + "T00:00:00").getTime();
  return Math.round((b - a) / 86400000);
}

/**
 * Anstehende/überfällige Meilensteine: 3-Monats-Honorarrate und Garantie-Ende.
 * `withinDays` begrenzt die Vorschau (Standard 45 Tage), Überfällige immer dabei.
 */
export async function getUpcomingMilestones(withinDays = 45): Promise<PlacementMilestone[]> {
  const placements = await getPlacements();
  const today = new Date().toISOString().slice(0, 10);
  const out: PlacementMilestone[] = [];

  for (const p of placements) {
    if (p.status === "ausgefallen" || p.status === "garantie_ok") continue;
    const split = placementSplitDate(p);
    const guarantee = placementGuaranteeUntil(p);

    if (split) {
      const d = daysBetween(today, split);
      if (d <= withinDays) {
        out.push({
          placement: p,
          kind: "split",
          label: "2. Honorarrate fällig (3 Monate)",
          date: split,
          daysUntil: d,
          overdue: d < 0,
        });
      }
    }
    if (guarantee) {
      const d = daysBetween(today, guarantee);
      if (d >= -7 && d <= withinDays) {
        out.push({
          placement: p,
          kind: "garantie",
          label: "Garantie-/Probezeit-Ende",
          date: guarantee,
          daysUntil: d,
          overdue: d < 0,
        });
      }
    }
  }
  out.sort((a, b) => a.date.localeCompare(b.date));
  return out;
}
