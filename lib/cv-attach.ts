"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { useMockData } from "@/lib/env";
import type { ActionResult } from "@/lib/crm-actions";

/**
 * Hängt eine bereits in den Bucket `candidate-cvs` hochgeladene CV-Datei an
 * eine:n BESTEHENDE:n Kandidat:in (setzt cv_path/cv_filename/cv_uploaded_at).
 * Läuft über die normale User-Session (ANON-Key); RLS stellt sicher, dass nur
 * eigene Kandidat:innen aktualisiert werden. Kein Service-Role-Key im Spiel.
 */
export async function attachCv(input: {
  candidateId: string;
  cv_path: string;
  cv_filename: string;
}): Promise<ActionResult> {
  if (useMockData) return { ok: true, demo: true };
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Keine aktive Session." };

  const { error } = await supabase
    .from("candidates")
    .update({
      cv_path: input.cv_path,
      cv_filename: input.cv_filename,
      cv_uploaded_at: new Date().toISOString(),
    })
    .eq("id", input.candidateId);
  if (error) return { ok: false, error: error.message };

  revalidatePath(`/cockpit/kandidaten/${input.candidateId}`);
  return { ok: true };
}
