"use server";

import { createClient } from "@/lib/supabase/server";
import { useMockData } from "@/lib/env";
import type { ActionResult } from "@/lib/crm-actions";

/**
 * DSGVO-Betroffenenrechte.
 *  - Art. 15 (Auskunft): exportCandidateData() – alle gespeicherten Daten
 *    eines Kandidaten strukturiert ausgeben.
 *  - Art. 17 (Löschung): eraseCandidate() – Anonymisierung (Default, reversibel
 *    nur über erneute Eingabe) oder harte Löschung (kaskadiert über FKs).
 *    Nicht-personenbezogene Audit-Logs (activity_log) bleiben unberührt.
 *
 * Alles partner-scoped (RLS schützt zusätzlich). Diese Funktionen werden NUR
 * durch eine explizite Nutzeraktion (Auskunfts-/Löschersuchen) ausgelöst.
 */

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

/** Hilfsfunktion: best-effort Select (fehlende Tabelle/Spalte ⇒ leer). */
async function safeSelect(
  table: string,
  column: string,
  candidateId: string
): Promise<unknown[]> {
  try {
    const supabase = createClient();
    const { data } = await supabase.from(table).select("*").eq(column, candidateId);
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

export interface CandidateExport {
  exportedAt: string;
  candidate: Record<string, unknown> | null;
  consents: unknown[];
  notes: unknown[];
  submissions: unknown[];
  matches: unknown[];
  interviews: unknown[];
  offers: unknown[];
  references: unknown[];
}

/** Art. 15 – vollständige Auskunft über alle gespeicherten Daten. */
export async function exportCandidateData(
  candidateId: string
): Promise<{ ok: boolean; error?: string; data?: CandidateExport }> {
  if (useMockData) return { ok: true, data: undefined };
  if (!candidateId) return { ok: false, error: "Kandidat fehlt." };
  const supabase = createClient();
  const { data: cand, error } = await supabase
    .from("candidates")
    .select("*")
    .eq("id", candidateId)
    .maybeSingle();
  if (error) return { ok: false, error: error.message };
  if (!cand) return { ok: false, error: "Kandidat nicht gefunden." };

  const [consents, notes, submissions, matches, interviews, offers, references] = await Promise.all([
    safeSelect("candidate_consents", "candidate_id", candidateId),
    safeSelect("candidate_notes", "candidate_id", candidateId),
    safeSelect("candidate_submissions", "candidate_id", candidateId),
    safeSelect("matches", "candidate_id", candidateId),
    safeSelect("candidate_interviews", "candidate_id", candidateId),
    safeSelect("candidate_offers", "candidate_id", candidateId),
    safeSelect("candidate_references", "candidate_id", candidateId),
  ]);

  return {
    ok: true,
    data: {
      exportedAt: new Date().toISOString(),
      candidate: cand as Record<string, unknown>,
      consents,
      notes,
      submissions,
      matches,
      interviews,
      offers,
      references,
    },
  };
}

// Personenbezogene Felder, die bei der Anonymisierung überschrieben werden.
const PII_RESET: Record<string, unknown> = {
  name: "Anonymisiert (DSGVO)",
  salutation: null,
  title: null,
  email: null,
  phone: null,
  linkedin_url: null,
  birth_date: null,
  location: null,
  zip: null,
  current_employer: null,
  languages: null,
  cv_path: null,
  cv_filename: null,
  photo_path: null,
  wechselmotivation: null,
  mandate_account: null,
  availability_status: "GESPERRT",
};

/**
 * Art. 17 – Löschung. mode="anonymize" (Default): personenbezogene Felder
 * entfernen, Status auf GESPERRT, Matches/Vorstellungen löschen (keine
 * Re-Vorstellung). mode="delete": Datensatz hart löschen (kaskadiert).
 */
export async function eraseCandidate(
  candidateId: string,
  mode: "anonymize" | "delete" = "anonymize"
): Promise<ActionResult> {
  if (useMockData) return { ok: true, demo: true };
  if (!candidateId) return { ok: false, error: "Kandidat fehlt." };

  const { id: pid, error: pErr } = await currentPartnerId();
  if (!pid) return { ok: false, error: pErr ?? "Kein Partner." };
  const supabase = createClient();

  if (mode === "delete") {
    const { error } = await supabase
      .from("candidates")
      .delete()
      .eq("id", candidateId)
      .eq("partner_id", pid);
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  }

  // Anonymisieren: PII überschreiben …
  const { error } = await supabase
    .from("candidates")
    .update(PII_RESET)
    .eq("id", candidateId)
    .eq("partner_id", pid);
  if (error) return { ok: false, error: error.message };

  // … und alle Weitergabe-/Vorstellungs-Verknüpfungen entfernen (best effort).
  await supabase.from("matches").delete().eq("candidate_id", candidateId).eq("partner_id", pid);
  await supabase.from("candidate_submissions").delete().eq("candidate_id", candidateId).eq("partner_id", pid);

  return { ok: true, warning: "Kandidat anonymisiert & für Vermittlung gesperrt." };
}
