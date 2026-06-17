"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { useMockData } from "@/lib/env";
import type { ActionResult } from "@/lib/crm-actions";
import type { PlacementStatus } from "@/lib/crm-types";

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

export interface PlacementInput {
  candidate_id?: string | null;
  mandate_id?: string | null;
  candidate_name: string;
  account_name?: string;
  role?: string;
  start_date?: string | null;
  agreed_fee?: number | null;
  guarantee_months?: number;
  notes?: string | null;
}

/** Platzierung anlegen + Kandidat:in automatisch auf „platziert" setzen. */
export async function createPlacement(input: PlacementInput): Promise<ActionResult> {
  if (!input.candidate_name?.trim()) return { ok: false, error: "Kandidat:in erforderlich." };
  if (useMockData) return DEMO;
  const { id: pid, error } = await currentPartnerId();
  if (!pid) return { ok: false, error };
  const supabase = createClient();

  const { error: insErr } = await supabase.from("placements").insert({
    partner_id: pid,
    candidate_id: input.candidate_id || null,
    mandate_id: input.mandate_id || null,
    candidate_name: input.candidate_name.trim(),
    account_name: input.account_name || null,
    role: input.role || null,
    start_date: input.start_date || null,
    agreed_fee: input.agreed_fee ?? null,
    guarantee_months: input.guarantee_months ?? 6,
    notes: input.notes || null,
  });
  if (insErr) {
    if (/relation .*placements.* does not exist/i.test(insErr.message)) {
      return { ok: false, error: "Tabelle placements fehlt – Migration 13_placements.sql ausführen." };
    }
    return { ok: false, error: insErr.message };
  }

  // Kandidat:in auf „platziert" + Mandats-Besetzung +1 (best effort).
  if (input.candidate_id) {
    await supabase.from("candidates").update({ stage: "platziert" }).eq("id", input.candidate_id);
  }
  if (input.mandate_id) {
    const { data: m } = await supabase
      .from("recruiting_mandates")
      .select("filled, positions")
      .eq("id", input.mandate_id)
      .maybeSingle();
    const md = m as { filled?: number; positions?: number } | null;
    if (md) {
      const filled = Math.min((md.filled ?? 0) + 1, md.positions ?? (md.filled ?? 0) + 1);
      await supabase.from("recruiting_mandates").update({ filled }).eq("id", input.mandate_id);
    }
    revalidatePath(`/cockpit/projekte/recruiting/${input.mandate_id}`);
  }
  revalidatePath("/cockpit/projekte/recruiting");
  revalidatePath("/cockpit");
  return { ok: true };
}

export async function setPlacementStatus(
  id: string,
  status: PlacementStatus,
  mandateId?: string
): Promise<ActionResult> {
  if (useMockData) return DEMO;
  const supabase = createClient();
  const { error } = await supabase.from("placements").update({ status }).eq("id", id);
  if (error) return { ok: false, error: error.message };
  if (mandateId) revalidatePath(`/cockpit/projekte/recruiting/${mandateId}`);
  revalidatePath("/cockpit");
  return { ok: true };
}

export async function deletePlacement(id: string, mandateId?: string): Promise<ActionResult> {
  if (useMockData) return DEMO;
  const supabase = createClient();
  const { error } = await supabase.from("placements").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };
  if (mandateId) revalidatePath(`/cockpit/projekte/recruiting/${mandateId}`);
  revalidatePath("/cockpit");
  return { ok: true };
}
