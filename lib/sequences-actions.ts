"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { useMockData } from "@/lib/env";
import type { ActionResult } from "@/lib/crm-actions";
import { getSequence, channelLabel } from "@/lib/sequences";

function dueDate(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

/**
 * Nimmt eine:n Kandidat:in in eine Outbound-Sequenz auf: legt für jeden
 * Schritt eine terminierte Aufgabe (crm_tasks) an.
 */
export async function enrollInSequence(
  candidateId: string,
  sequenceKey: string
): Promise<ActionResult> {
  const seq = getSequence(sequenceKey);
  if (!seq) return { ok: false, error: "Unbekannte Sequenz." };
  if (useMockData) return { ok: true, demo: true };

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Keine aktive Session." };
  const { data: p } = await supabase.from("partners").select("id").eq("auth_user_id", user.id).single();
  const pid = (p as { id?: string } | null)?.id;
  if (!pid) return { ok: false, error: "Kein Partner-Profil gefunden." };

  const { data: cand } = await supabase.from("candidates").select("name").eq("id", candidateId).maybeSingle();
  const name = (cand as { name?: string } | null)?.name ?? "Kandidat:in";

  const rows = seq.steps.map((step) => ({
    partner_id: pid,
    related_type: "candidate",
    related_id: candidateId,
    related_label: name,
    title: `[${channelLabel[step.channel]}] ${step.title}`,
    due_date: dueDate(step.dayOffset),
  }));

  const { error } = await supabase.from("crm_tasks").insert(rows);
  if (error) return { ok: false, error: error.message };

  revalidatePath(`/cockpit/kandidaten/${candidateId}`);
  revalidatePath("/cockpit/aufgaben");
  revalidatePath("/cockpit/kalender");
  return { ok: true };
}
