"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { useMockData } from "@/lib/env";
import { assertCanPresent } from "@/lib/dsgvo/consent";
import {
  rankCandidatesForProject,
  rankProjectsForCandidate,
  type CandidateMatchHit,
  type ProjectMatchHit,
} from "@/lib/candidate-project-match";
import type { ActionResult } from "@/lib/crm-actions";
import type { MatchStatus } from "@/lib/match-status";

/**
 * Match-Actions (Kandidat ↔ HubSpot-Projekt / project_refs).
 *
 * WICHTIG: Das Consent-Gate wird hier in der Business-Logik erzwungen –
 * nicht nur in der UI. Ohne gültige Einwilligung (VERMITTLUNG/WEITERGABE_AN_KUNDE)
 * kann ein Kandidat weder vorgeschlagen noch vorgestellt werden.
 */


/** Status, die eine echte Weitergabe an den Kunden bedeuten → Consent zwingend. */
const PRESENTING: MatchStatus[] = ["VORGESCHLAGEN", "GEPRUEFT", "VORGESTELLT", "PLATZIERT"];

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

/**
 * Kandidat einem HubSpot-Projekt vorschlagen (Match anlegen/aktualisieren).
 * Blockiert ohne gültige Einwilligung (Consent-Gate).
 */
export async function proposeMatch(
  candidateId: string,
  projectRefId: string,
  opts?: { score?: number; gruende?: unknown }
): Promise<ActionResult> {
  if (useMockData) return { ok: true, demo: true };
  if (!candidateId || !projectRefId) return { ok: false, error: "Kandidat/Projekt fehlt." };

  // ── Consent-Gate ──────────────────────────────────────────────
  const gate = await assertCanPresent(candidateId);
  if (!gate.ok) return { ok: false, error: gate.error };

  const { id: pid, error: pErr } = await currentPartnerId();
  if (!pid) return { ok: false, error: pErr ?? "Kein Partner." };

  const supabase = createClient();
  // ignoreDuplicates: einen bereits bestehenden Match NICHT auf VORGESCHLAGEN
  // zurücksetzen oder dessen Score/Begründung überschreiben.
  const { error } = await supabase.from("matches").upsert(
    {
      partner_id: pid,
      candidate_id: candidateId,
      project_ref_id: projectRefId,
      score: opts?.score ?? null,
      match_gruende: opts?.gruende ?? null,
      status: "VORGESCHLAGEN",
      updated_at: new Date().toISOString(),
    },
    { onConflict: "partner_id,candidate_id,project_ref_id", ignoreDuplicates: true }
  );
  if (error) return { ok: false, error: error.message };

  revalidatePath(`/cockpit/kandidaten/${candidateId}`);
  revalidatePath("/cockpit/match");
  return { ok: true };
}

/**
 * Match-Status ändern. Beim Wechsel auf einen „präsentierenden" Status wird
 * das Consent-Gate erneut geprüft (Einwilligung könnte zwischenzeitlich
 * widerrufen/abgelaufen sein).
 */
export async function updateMatchStatus(
  matchId: string,
  status: MatchStatus
): Promise<ActionResult> {
  if (useMockData) return { ok: true, demo: true };
  if (!matchId) return { ok: false, error: "Match nicht gefunden." };

  const { id: pid, error: pErr } = await currentPartnerId();
  if (!pid) return { ok: false, error: pErr ?? "Kein Partner." };

  const supabase = createClient();
  const { data: row, error: readErr } = await supabase
    .from("matches")
    .select("candidate_id")
    .eq("id", matchId)
    .eq("partner_id", pid)
    .maybeSingle();
  if (readErr || !row) return { ok: false, error: "Match nicht gefunden." };
  const candidateId = String((row as { candidate_id: string }).candidate_id);

  if (PRESENTING.includes(status)) {
    const gate = await assertCanPresent(candidateId);
    if (!gate.ok) return { ok: false, error: gate.error };
  }

  const patch: Record<string, unknown> = {
    status,
    updated_at: new Date().toISOString(),
  };
  if (status === "VORGESTELLT") patch.vorgestellt_am = new Date().toISOString();

  const { error } = await supabase
    .from("matches")
    .update(patch)
    .eq("id", matchId)
    .eq("partner_id", pid);
  if (error) return { ok: false, error: error.message };

  // Workflow-Automatik: Match-Status zieht den Kandidaten-Status nach
  // (best effort – der Match-Wechsel ist bereits persistiert).
  if (status === "PLATZIERT") {
    await supabase
      .from("candidates")
      .update({ availability_status: "PLATZIERT" })
      .eq("id", candidateId)
      .eq("partner_id", pid);
  } else if (status === "VORGESTELLT") {
    await supabase
      .from("candidates")
      .update({ availability_status: "IN_VERMITTLUNG" })
      .eq("id", candidateId)
      .eq("partner_id", pid)
      .in("availability_status", ["NEU", "AKTIV_VERFUEGBAR"]);
  }

  revalidatePath(`/cockpit/kandidaten/${candidateId}`);
  revalidatePath("/cockpit/match");
  return { ok: true };
}

/** Server-Action für die UI: rankt Kandidaten gegen ein gewähltes Projekt. */
export async function rankForProjectAction(
  projectRefId: string
): Promise<{ ok: boolean; error?: string; titel?: string | null; hits: CandidateMatchHit[] }> {
  if (!projectRefId) return { ok: false, error: "Kein Projekt gewählt.", hits: [] };
  const res = await rankCandidatesForProject(projectRefId, 30);
  return { ok: res.ok, error: res.error, titel: res.project?.titel ?? null, hits: res.hits };
}

/** Server-Action: rankt offene HubSpot-Projekte für eine:n Kandidat:in (Reverse-Match). */
export async function rankProjectsForCandidateAction(
  candidateId: string
): Promise<{ ok: boolean; error?: string; hits: ProjectMatchHit[]; vorstellbar: boolean }> {
  if (!candidateId) return { ok: false, error: "Kein Kandidat.", hits: [], vorstellbar: false };
  return rankProjectsForCandidate(candidateId, 8);
}

/** Match entfernen (z.B. versehentlicher Vorschlag). Partner-scoped. */
export async function deleteMatch(matchId: string): Promise<ActionResult> {
  if (useMockData) return { ok: true, demo: true };
  if (!matchId) return { ok: false, error: "Match nicht gefunden." };
  const { id: pid, error: pErr } = await currentPartnerId();
  if (!pid) return { ok: false, error: pErr ?? "Kein Partner." };
  const supabase = createClient();
  const { data, error } = await supabase
    .from("matches")
    .delete()
    .eq("id", matchId)
    .eq("partner_id", pid)
    .select("candidate_id");
  if (error) return { ok: false, error: error.message };
  if (!data || data.length === 0) return { ok: false, error: "Match nicht gefunden." };
  revalidatePath(`/cockpit/kandidaten/${String((data[0] as { candidate_id: string }).candidate_id)}`);
  revalidatePath("/cockpit/match");
  return { ok: true };
}

/** HubSpot-Projekt-Sync aus der UI anstoßen (Partner-Session). */
export async function syncProjectsAction(): Promise<{
  ok: boolean;
  error?: string;
  synced?: number;
  setup?: string[];
}> {
  const { syncHubspotProjects } = await import("@/lib/hubspot/sync");
  const res = await syncHubspotProjects();
  if (res.ok) revalidatePath("/cockpit/match");
  return res;
}
