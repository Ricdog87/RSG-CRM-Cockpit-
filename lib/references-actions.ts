"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { useMockData } from "@/lib/env";
import type { ActionResult } from "@/lib/crm-actions";
import type { ReferenceStatus } from "@/lib/crm-types";

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

export interface ReferenceInput {
  candidate_id: string;
  referee_name?: string | null;
  relationship?: string | null;
  contact?: string | null;
  status?: ReferenceStatus;
  feedback?: string | null;
}

export async function createReference(input: ReferenceInput): Promise<ActionResult> {
  if (!input.candidate_id) return { ok: false, error: "Kandidat:in fehlt." };
  if (useMockData) return DEMO;
  const { id: pid, error } = await currentPartnerId();
  if (!pid) return { ok: false, error };
  const supabase = createClient();
  const { error: insErr } = await supabase.from("candidate_references").insert({
    partner_id: pid,
    candidate_id: input.candidate_id,
    referee_name: input.referee_name || null,
    relationship: input.relationship || null,
    contact: input.contact || null,
    status: input.status || "angefragt",
    feedback: input.feedback || null,
  });
  if (insErr) {
    if (/relation .*candidate_references.* does not exist/i.test(insErr.message))
      return { ok: false, error: "Tabelle candidate_references fehlt – Migration 17 ausführen." };
    return { ok: false, error: insErr.message };
  }
  revalidatePath(`/cockpit/kandidaten/${input.candidate_id}`);
  return { ok: true };
}

export async function updateReference(
  id: string,
  candidateId: string,
  patch: { status?: ReferenceStatus; feedback?: string | null }
): Promise<ActionResult> {
  if (useMockData) return DEMO;
  const supabase = createClient();
  const { error } = await supabase.from("candidate_references").update(patch).eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/cockpit/kandidaten/${candidateId}`);
  return { ok: true };
}

export async function deleteReference(id: string, candidateId: string): Promise<ActionResult> {
  if (useMockData) return DEMO;
  const supabase = createClient();
  const { error } = await supabase.from("candidate_references").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/cockpit/kandidaten/${candidateId}`);
  return { ok: true };
}

/** Aftercare/NPS einer Platzierung aktualisieren. */
export async function updatePlacementAftercare(
  id: string,
  mandateId: string | undefined,
  patch: { client_nps?: number | null; candidate_nps?: number | null; aftercare_notes?: string | null }
): Promise<ActionResult> {
  if (useMockData) return DEMO;
  const supabase = createClient();
  const { error } = await supabase
    .from("placements")
    .update({
      client_nps: patch.client_nps ?? null,
      candidate_nps: patch.candidate_nps ?? null,
      aftercare_notes: patch.aftercare_notes || null,
    })
    .eq("id", id);
  if (error) {
    if (/column .*(client_nps|candidate_nps|aftercare_notes).* does not exist/i.test(error.message))
      return { ok: false, error: "Spalten fehlen – Migration 17_references_aftercare.sql ausführen." };
    return { ok: false, error: error.message };
  }
  if (mandateId) revalidatePath(`/cockpit/projekte/recruiting/${mandateId}`);
  return { ok: true };
}
