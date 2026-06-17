import "server-only";
import { createClient } from "@/lib/supabase/server";
import { useMockData } from "@/lib/env";
import type { KiMilestone, MilestoneStatus } from "@/lib/ki-plan";

type Row = Record<string, unknown>;
const str = (v: unknown): string => (v == null ? "" : String(v));

function mapMilestone(r: Row): KiMilestone {
  return {
    id: str(r.id),
    project_id: str(r.project_id),
    title: str(r.title),
    sort_order: Number(r.sort_order ?? 0),
    status: (str(r.status) || "offen") as MilestoneStatus,
    target_date: str(r.target_date) || undefined,
    done_date: str(r.done_date) || undefined,
    notes: str(r.notes) || undefined,
  };
}

export async function getMilestonesForProject(projectId: string): Promise<KiMilestone[]> {
  if (useMockData) return [];
  try {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("ki_milestones")
      .select("*")
      .eq("project_id", projectId)
      .order("sort_order", { ascending: true });
    if (error || !data) return [];
    return (data as Row[]).map(mapMilestone);
  } catch {
    return [];
  }
}

/** Readiness als Map item_key → checked. */
export async function getReadinessForProject(projectId: string): Promise<Record<string, boolean>> {
  if (useMockData) return {};
  try {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("ki_readiness")
      .select("item_key, checked")
      .eq("project_id", projectId);
    if (error || !data) return {};
    const out: Record<string, boolean> = {};
    for (const r of data as Row[]) out[str(r.item_key)] = Boolean(r.checked);
    return out;
  } catch {
    return {};
  }
}
