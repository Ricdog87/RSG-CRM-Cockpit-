"use server";

import { createClient } from "@/lib/supabase/server";
import { createServiceClient, hasServiceRole } from "@/lib/supabase/service";
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
  fonioCalls: unknown[];
  placements: unknown[];
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

  const [consents, notes, submissions, matches, interviews, offers, references, fonioCalls, placements] =
    await Promise.all([
      safeSelect("candidate_consents", "candidate_id", candidateId),
      safeSelect("candidate_notes", "candidate_id", candidateId),
      safeSelect("candidate_submissions", "candidate_id", candidateId),
      safeSelect("matches", "candidate_id", candidateId),
      safeSelect("candidate_interviews", "candidate_id", candidateId),
      safeSelect("candidate_offers", "candidate_id", candidateId),
      safeSelect("candidate_references", "candidate_id", candidateId),
      safeSelect("fonio_calls", "candidate_id", candidateId),
      safeSelect("placements", "candidate_id", candidateId),
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
      fonioCalls,
      placements,
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
  const session = createClient();

  // Eigentümerschaft prüfen + Datei-Pfade holen (RLS-scoped). Kein Treffer ⇒
  // kein Zugriffsrecht/existiert nicht → NICHT stillschweigend „ok" melden.
  const { data: owned, error: ownErr } = await session
    .from("candidates")
    .select("cv_path, photo_path")
    .eq("id", candidateId)
    .eq("partner_id", pid)
    .maybeSingle();
  if (ownErr) return { ok: false, error: ownErr.message };
  if (!owned) return { ok: false, error: "Kandidat nicht gefunden oder gehört einem anderen Partner." };
  const cvPath = (owned as { cv_path?: string | null }).cv_path ?? null;
  const photoPath = (owned as { photo_path?: string | null }).photo_path ?? null;

  // Für die eigentliche Löschung Service-Role bevorzugen (umgeht RLS-Lücken bei
  // Kind-Tabellen). Streng auf diesen Kandidaten scoped – Ownership ist oben
  // verifiziert, candidate_id ist eindeutig einem Partner zugeordnet.
  const db = hasServiceRole() ? createServiceClient() : session;

  // 1) Dateien im Storage entfernen (sonst verwaiste, nicht auffindbare PII).
  if (cvPath) {
    try { await db.storage.from("candidate-cvs").remove([cvPath]); } catch { /* best effort */ }
  }
  if (photoPath) {
    try { await db.storage.from("candidate-photos").remove([photoPath]); } catch { /* best effort */ }
  }

  // 2) Anruf-Rohdaten (Nummer, Transkript, KI-Summary) – FK ist „set null",
  //    also explizit löschen, sonst bleiben sie als verwaiste PII stehen.
  await db.from("fonio_calls").delete().eq("candidate_id", candidateId);
  // 3) Weitergabe-/Vorstellungs-Verknüpfungen (keine Re-Vorstellung möglich).
  await db.from("matches").delete().eq("candidate_id", candidateId);
  await db.from("candidate_submissions").delete().eq("candidate_id", candidateId);
  // 4) Klartext-Name in Platzierungen neutralisieren (überlebt sonst beide Modi).
  await db.from("placements").update({ candidate_name: "Anonymisiert (DSGVO)" }).eq("candidate_id", candidateId);

  if (mode === "delete") {
    // Harte Löschung: Kind-Daten explizit weg, dann Kandidat.
    await db.from("candidate_notes").delete().eq("candidate_id", candidateId);
    await db.from("candidate_interviews").delete().eq("candidate_id", candidateId);
    await db.from("candidate_offers").delete().eq("candidate_id", candidateId);
    await db.from("candidate_references").delete().eq("candidate_id", candidateId);
    await db.from("candidate_consents").delete().eq("candidate_id", candidateId);
    const { data: del, error } = await db
      .from("candidates")
      .delete()
      .eq("id", candidateId)
      .eq("partner_id", pid)
      .select("id");
    if (error) return { ok: false, error: error.message };
    if (!del || del.length === 0) return { ok: false, error: "Löschung nicht ausgeführt." };
    return { ok: true };
  }

  // Anonymisieren: PII in der Kandidatenzeile überschreiben …
  const { data: upd, error } = await db
    .from("candidates")
    .update(PII_RESET)
    .eq("id", candidateId)
    .eq("partner_id", pid)
    .select("id");
  if (error) return { ok: false, error: error.message };
  if (!upd || upd.length === 0) return { ok: false, error: "Anonymisierung nicht ausgeführt." };

  // … Consent-Nachweis (email_to/ip/ua) neutralisieren – sonst trivial re-identifizierbar.
  await db.from("candidate_consents")
    .update({ email_to: null, ip_address: null, user_agent: null })
    .eq("candidate_id", candidateId);
  // … Freitext-behaftete Kind-Tabellen entfernen.
  await db.from("candidate_notes").delete().eq("candidate_id", candidateId);
  await db.from("candidate_interviews").delete().eq("candidate_id", candidateId);
  await db.from("candidate_offers").delete().eq("candidate_id", candidateId);
  await db.from("candidate_references").delete().eq("candidate_id", candidateId);

  return { ok: true, warning: "Kandidat anonymisiert & für Vermittlung gesperrt." };
}
