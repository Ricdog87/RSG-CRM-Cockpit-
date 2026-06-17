"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { useMockData } from "@/lib/env";
import type { ActionResult } from "@/lib/crm-actions";
import type { InterviewStatus, InterviewType, OfferStatus } from "@/lib/crm-types";

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

function missingTable(msg: string, table: string): boolean {
  return new RegExp(`relation .*${table}.* does not exist`, "i").test(msg);
}

// ---------- Interviews ----------------------------------------------

export interface InterviewInput {
  candidate_id: string;
  mandate_id?: string | null;
  scheduled_at?: string | null;
  type: InterviewType;
  interviewer?: string | null;
  location?: string | null;
  status?: InterviewStatus;
  score?: number | null;
  feedback?: string | null;
}

export async function createInterview(input: InterviewInput): Promise<ActionResult> {
  if (!input.candidate_id) return { ok: false, error: "Kandidat:in fehlt." };
  if (useMockData) return DEMO;
  const { id: pid, error } = await currentPartnerId();
  if (!pid) return { ok: false, error };
  const supabase = createClient();
  const { error: insErr } = await supabase.from("candidate_interviews").insert({
    partner_id: pid,
    candidate_id: input.candidate_id,
    mandate_id: input.mandate_id || null,
    scheduled_at: input.scheduled_at || null,
    type: input.type || "telefon",
    interviewer: input.interviewer || null,
    location: input.location || null,
    status: input.status || "geplant",
    score: input.score ?? null,
    feedback: input.feedback || null,
  });
  if (insErr) {
    if (missingTable(insErr.message, "candidate_interviews"))
      return { ok: false, error: "Tabelle candidate_interviews fehlt – Migration 14 ausführen." };
    return { ok: false, error: insErr.message };
  }
  revalidatePath(`/cockpit/kandidaten/${input.candidate_id}`);
  return { ok: true };
}

export async function updateInterview(
  id: string,
  candidateId: string,
  patch: { status?: InterviewStatus; score?: number | null; feedback?: string | null }
): Promise<ActionResult> {
  if (useMockData) return DEMO;
  const supabase = createClient();
  const { error } = await supabase.from("candidate_interviews").update(patch).eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/cockpit/kandidaten/${candidateId}`);
  return { ok: true };
}

export async function deleteInterview(id: string, candidateId: string): Promise<ActionResult> {
  if (useMockData) return DEMO;
  const supabase = createClient();
  const { error } = await supabase.from("candidate_interviews").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/cockpit/kandidaten/${candidateId}`);
  return { ok: true };
}

// ---------- Angebote -------------------------------------------------

export interface OfferInput {
  candidate_id: string;
  mandate_id?: string | null;
  offered_salary?: number | null;
  start_date?: string | null;
  offer_date?: string | null;
  status?: OfferStatus;
  decline_reason?: string | null;
  notes?: string | null;
}

export async function createOffer(input: OfferInput): Promise<ActionResult> {
  if (!input.candidate_id) return { ok: false, error: "Kandidat:in fehlt." };
  if (useMockData) return DEMO;
  const { id: pid, error } = await currentPartnerId();
  if (!pid) return { ok: false, error };
  const supabase = createClient();
  const { error: insErr } = await supabase.from("candidate_offers").insert({
    partner_id: pid,
    candidate_id: input.candidate_id,
    mandate_id: input.mandate_id || null,
    offered_salary: input.offered_salary ?? null,
    start_date: input.start_date || null,
    offer_date: input.offer_date || null,
    status: input.status || "entwurf",
    decline_reason: input.decline_reason || null,
    notes: input.notes || null,
  });
  if (insErr) {
    if (missingTable(insErr.message, "candidate_offers"))
      return { ok: false, error: "Tabelle candidate_offers fehlt – Migration 14 ausführen." };
    return { ok: false, error: insErr.message };
  }
  // Phase angleichen: Angebot ⇒ Kandidat:in mindestens „angebot".
  await supabase.from("candidates").update({ stage: "angebot" }).eq("id", input.candidate_id);
  revalidatePath(`/cockpit/kandidaten/${input.candidate_id}`);
  return { ok: true };
}

export async function updateOffer(
  id: string,
  candidateId: string,
  patch: { status?: OfferStatus; decline_reason?: string | null }
): Promise<ActionResult> {
  if (useMockData) return DEMO;
  const supabase = createClient();
  const { error } = await supabase.from("candidate_offers").update(patch).eq("id", id);
  if (error) return { ok: false, error: error.message };
  // Abgelehntes Angebot ⇒ Kandidat:in auf „Absage" (Lernsignal fürs Matching).
  if (patch.status === "abgelehnt") {
    await supabase.from("candidates").update({ stage: "abgelehnt" }).eq("id", candidateId);
  }
  revalidatePath(`/cockpit/kandidaten/${candidateId}`);
  return { ok: true };
}

export async function deleteOffer(id: string, candidateId: string): Promise<ActionResult> {
  if (useMockData) return DEMO;
  const supabase = createClient();
  const { error } = await supabase.from("candidate_offers").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/cockpit/kandidaten/${candidateId}`);
  return { ok: true };
}
