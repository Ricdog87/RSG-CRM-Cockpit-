"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { useMockData } from "@/lib/env";
import type { ActionResult } from "@/lib/crm-actions";
import { DEFAULT_MILESTONES, type MilestoneStatus } from "@/lib/ki-plan";

const DEMO: ActionResult = { ok: true, demo: true };

async function currentPartnerId(): Promise<{ id: string | null; error?: string }> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { id: null, error: "Keine aktive Session." };
  const { data, error } = await supabase
    .from("partners")
    .select("id")
    .eq("auth_user_id", user.id)
    .single();
  if (error || !data) return { id: null, error: "Kein Partner-Profil gefunden." };
  return { id: data.id as string };
}

function rv(projectId: string) {
  revalidatePath(`/cockpit/projekte/ki/${projectId}`);
}

function missing(msg: string, table: string): boolean {
  return new RegExp(`relation .*${table}.* does not exist`, "i").test(msg);
}

/** Standard-Projektplan (7 Meilensteine) anlegen, falls noch keiner existiert. */
export async function seedDefaultMilestones(projectId: string): Promise<ActionResult> {
  if (useMockData) return DEMO;
  const { id: pid, error } = await currentPartnerId();
  if (!pid) return { ok: false, error };
  const supabase = createClient();
  const { count } = await supabase
    .from("ki_milestones")
    .select("id", { count: "exact", head: true })
    .eq("project_id", projectId);
  if ((count ?? 0) > 0) return { ok: false, error: "Es gibt bereits Meilensteine." };

  const rows = DEFAULT_MILESTONES.map((title, i) => ({
    partner_id: pid,
    project_id: projectId,
    title,
    sort_order: i,
    status: "offen" as MilestoneStatus,
  }));
  const { error: insErr } = await supabase.from("ki_milestones").insert(rows);
  if (insErr) {
    if (missing(insErr.message, "ki_milestones"))
      return { ok: false, error: "Tabelle ki_milestones fehlt – Migration 20 ausführen." };
    return { ok: false, error: insErr.message };
  }
  rv(projectId);
  return { ok: true };
}

export async function addMilestone(
  projectId: string,
  title: string,
  targetDate?: string | null
): Promise<ActionResult> {
  if (!title.trim()) return { ok: false, error: "Titel erforderlich." };
  if (useMockData) return DEMO;
  const { id: pid, error } = await currentPartnerId();
  if (!pid) return { ok: false, error };
  const supabase = createClient();
  const { count } = await supabase
    .from("ki_milestones")
    .select("id", { count: "exact", head: true })
    .eq("project_id", projectId);
  const { error: insErr } = await supabase.from("ki_milestones").insert({
    partner_id: pid,
    project_id: projectId,
    title: title.trim(),
    sort_order: count ?? 0,
    target_date: targetDate || null,
  });
  if (insErr) return { ok: false, error: insErr.message };
  rv(projectId);
  return { ok: true };
}

export async function updateMilestone(
  id: string,
  projectId: string,
  patch: { status?: MilestoneStatus; target_date?: string | null }
): Promise<ActionResult> {
  if (useMockData) return DEMO;
  const supabase = createClient();
  const set: Record<string, unknown> = { ...patch };
  if (patch.status === "erledigt") set.done_date = new Date().toISOString().slice(0, 10);
  if (patch.status && patch.status !== "erledigt") set.done_date = null;
  const { error } = await supabase.from("ki_milestones").update(set).eq("id", id);
  if (error) return { ok: false, error: error.message };
  rv(projectId);
  return { ok: true };
}

export async function deleteMilestone(id: string, projectId: string): Promise<ActionResult> {
  if (useMockData) return DEMO;
  const supabase = createClient();
  const { error } = await supabase.from("ki_milestones").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };
  rv(projectId);
  return { ok: true };
}

/** Readiness-Item togglen (upsert). */
export async function toggleReadiness(
  projectId: string,
  itemKey: string,
  checked: boolean
): Promise<ActionResult> {
  if (useMockData) return DEMO;
  const { id: pid, error } = await currentPartnerId();
  if (!pid) return { ok: false, error };
  const supabase = createClient();
  const { error: upErr } = await supabase
    .from("ki_readiness")
    .upsert(
      { partner_id: pid, project_id: projectId, item_key: itemKey, checked, updated_at: new Date().toISOString() },
      { onConflict: "project_id,item_key" }
    );
  if (upErr) {
    if (missing(upErr.message, "ki_readiness"))
      return { ok: false, error: "Tabelle ki_readiness fehlt – Migration 20 ausführen." };
    return { ok: false, error: upErr.message };
  }
  rv(projectId);
  return { ok: true };
}
