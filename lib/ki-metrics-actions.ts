"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { useMockData } from "@/lib/env";
import type { ActionResult } from "@/lib/crm-actions";

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

export interface MetricInput {
  project_id: string;
  period: string;
  calls?: number | null;
  automation_rate?: number | null;
  containment_rate?: number | null;
  escalations?: number | null;
  avg_handle_seconds?: number | null;
  uptime?: number | null;
  tokens?: number | null;
  token_cost?: number | null;
  csat?: number | null;
  notes?: string | null;
}

/** Monatswert anlegen/aktualisieren (Upsert über project_id+period). */
export async function upsertMetric(input: MetricInput): Promise<ActionResult> {
  if (!input.project_id || !/^\d{4}-\d{2}$/.test(input.period))
    return { ok: false, error: "Projekt und Monat (yyyy-mm) erforderlich." };
  if (useMockData) return DEMO;
  const { id: pid, error } = await currentPartnerId();
  if (!pid) return { ok: false, error };
  const supabase = createClient();
  const { error: upErr } = await supabase.from("ki_metrics").upsert(
    {
      partner_id: pid,
      project_id: input.project_id,
      period: input.period,
      calls: input.calls ?? null,
      automation_rate: input.automation_rate ?? null,
      containment_rate: input.containment_rate ?? null,
      escalations: input.escalations ?? null,
      avg_handle_seconds: input.avg_handle_seconds ?? null,
      uptime: input.uptime ?? null,
      tokens: input.tokens ?? null,
      token_cost: input.token_cost ?? null,
      csat: input.csat ?? null,
      notes: input.notes ?? null,
    },
    { onConflict: "project_id,period" }
  );
  if (upErr) {
    if (/relation .*ki_metrics.* does not exist/i.test(upErr.message))
      return { ok: false, error: "Tabelle ki_metrics fehlt – Migration 21 ausführen." };
    return { ok: false, error: upErr.message };
  }
  revalidatePath(`/cockpit/projekte/ki/${input.project_id}`);
  return { ok: true };
}

export async function deleteMetric(id: string, projectId: string): Promise<ActionResult> {
  if (useMockData) return DEMO;
  const { id: pid, error: pidErr } = await currentPartnerId();
  if (!pid) return { ok: false, error: pidErr };
  const supabase = createClient();
  const { error } = await supabase.from("ki_metrics").delete().eq("id", id).eq("partner_id", pid);
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/cockpit/projekte/ki/${projectId}`);
  return { ok: true };
}
