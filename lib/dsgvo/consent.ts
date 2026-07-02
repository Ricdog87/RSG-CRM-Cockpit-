import "server-only";
import { createClient } from "@/lib/supabase/server";

/**
 * DSGVO-Consent-Gate — das Herzstück der Datenschutz-Datenbank.
 *
 * Prüft VOR jeder Weitergabe/Vorstellung eines Kandidaten an einen Kunden,
 * ob eine gültige Einwilligung vorliegt. Wird in der Business-Logik
 * (matches-actions) erzwungen — nicht nur in der UI.
 *
 * Bezieht sich auf die additiv erweiterte Tabelle `candidate_consents`
 * (Spalte `zweck` aus Migration 30). Bestandsdaten ohne `zweck` (NULL) gelten
 * als allgemeine Profil-Einwilligung (PROFIL_SPEICHERN) – nicht als
 * Vermittlungs-Freigabe.
 */

export type ConsentPurpose = "PROFIL_SPEICHERN" | "VERMITTLUNG" | "WEITERGABE_AN_KUNDE";
export type ConsentState = "ERTEILT" | "WIDERRUFEN" | "ABGELAUFEN" | "KEINE";

interface ConsentRowLite {
  status: string;
  zweck: string | null;
  granted_at: string | null;
  revoked_at: string | null;
  expires_at: string | null;
  created_at: string;
}

/**
 * Reine Statuslogik (ohne DB): jüngsten entscheidenden Record je Zweck werten.
 * `records` müssen nach created_at absteigend sortiert sein.
 */
function effectiveState(records: ConsentRowLite[], purpose: ConsentPurpose, now: number): ConsentState {
  const relevant = records.filter(
    (r) => r.zweck === purpose || (r.zweck == null && purpose === "PROFIL_SPEICHERN")
  );
  const rec = relevant.find(
    (r) => r.status === "granted" || r.status === "revoked" || r.granted_at || r.revoked_at
  );
  if (!rec) return "KEINE";
  if (rec.status === "revoked" || rec.revoked_at) return "WIDERRUFEN";
  if (rec.status !== "granted") return "KEINE";
  if (rec.expires_at && new Date(rec.expires_at).getTime() < now) return "ABGELAUFEN";
  return "ERTEILT";
}

/**
 * Alle vorstellbaren Kandidat-IDs des Partners (gültige VERMITTLUNG- oder
 * WEITERGABE_AN_KUNDE-Einwilligung) – für Listen-Filter/Badges. Lädt alle
 * Consents paginiert (global created_at desc ⇒ auch je Kandidat desc).
 */
export async function getPresentableCandidateIds(): Promise<string[]> {
  try {
    const supabase = createClient();
    const rows: (ConsentRowLite & { candidate_id: string })[] = [];
    for (let page = 0; page < 10; page++) {
      const { data, error } = await supabase
        .from("candidate_consents")
        .select("candidate_id, status, zweck, granted_at, revoked_at, expires_at, created_at")
        .order("created_at", { ascending: false })
        .range(page * 1000, page * 1000 + 999);
      if (error || !data || data.length === 0) break;
      rows.push(...(data as (ConsentRowLite & { candidate_id: string })[]));
      if (data.length < 1000) break;
    }
    const byCand = new Map<string, ConsentRowLite[]>();
    for (const r of rows) {
      const arr = byCand.get(r.candidate_id) ?? [];
      arr.push(r);
      byCand.set(r.candidate_id, arr);
    }
    const now = Date.now();
    const ids: string[] = [];
    for (const [cid, recs] of byCand) {
      if (
        effectiveState(recs, "VERMITTLUNG", now) === "ERTEILT" ||
        effectiveState(recs, "WEITERGABE_AN_KUNDE", now) === "ERTEILT"
      ) {
        ids.push(cid);
      }
    }
    return ids;
  } catch {
    return [];
  }
}

/**
 * Batch-Consent-Gate: liefert die Menge der Kandidat-IDs, die einem Kunden
 * vorgestellt werden dürfen (gültige VERMITTLUNG- oder WEITERGABE_AN_KUNDE-
 * Einwilligung). Eine einzige Query statt N×assertCanPresent.
 */
export async function batchCanPresent(candidateIds: string[]): Promise<Set<string>> {
  const ok = new Set<string>();
  if (candidateIds.length === 0) return ok;
  const supabase = createClient();
  const { data, error } = await supabase
    .from("candidate_consents")
    .select("candidate_id, status, zweck, granted_at, revoked_at, expires_at, created_at")
    .in("candidate_id", candidateIds)
    .order("created_at", { ascending: false });
  if (error || !data) return ok;
  const byCand = new Map<string, ConsentRowLite[]>();
  for (const r of data as (ConsentRowLite & { candidate_id: string })[]) {
    const arr = byCand.get(r.candidate_id) ?? [];
    arr.push(r);
    byCand.set(r.candidate_id, arr);
  }
  const now = Date.now();
  for (const [cid, recs] of byCand) {
    if (
      effectiveState(recs, "VERMITTLUNG", now) === "ERTEILT" ||
      effectiveState(recs, "WEITERGABE_AN_KUNDE", now) === "ERTEILT"
    ) {
      ok.add(cid);
    }
  }
  return ok;
}

/** Ermittelt den aktuellen Einwilligungs-Status für einen konkreten Zweck. */
export async function consentStateFor(
  candidateId: string,
  purpose: ConsentPurpose
): Promise<ConsentState> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("candidate_consents")
    .select("status, zweck, granted_at, revoked_at, expires_at, created_at")
    .eq("candidate_id", candidateId)
    .order("created_at", { ascending: false })
    .limit(100);
  if (error || !data || data.length === 0) return "KEINE";

  // Jüngsten entscheidenden Record je Zweck werten (pending überspringen).
  return effectiveState(data as ConsentRowLite[], purpose, Date.now());
}

function blockMessage(state: ConsentState): string {
  switch (state) {
    case "WIDERRUFEN":
      return "Einwilligung widerrufen – Weitergabe an Kunden nicht erlaubt.";
    case "ABGELAUFEN":
      return "Einwilligung abgelaufen – bitte neu einholen, bevor du den Kandidaten vorstellst.";
    default:
      return "Keine gültige Einwilligung zur Vermittlung/Weitergabe – bitte zuerst einholen.";
  }
}

/**
 * Consent-Gate: Darf dieser Kandidat einem Kunden/Projekt vorgeschlagen bzw.
 * vorgestellt werden? Verlangt eine gültige Einwilligung für VERMITTLUNG
 * ODER WEITERGABE_AN_KUNDE.
 */
export async function assertCanPresent(
  candidateId: string
): Promise<{ ok: boolean; error?: string; state?: ConsentState }> {
  const [verm, weit] = await Promise.all([
    consentStateFor(candidateId, "VERMITTLUNG"),
    consentStateFor(candidateId, "WEITERGABE_AN_KUNDE"),
  ]);
  if (verm === "ERTEILT" || weit === "ERTEILT") return { ok: true, state: "ERTEILT" };
  // Aussagekräftigsten Status für die Meldung wählen.
  const state: ConsentState = verm !== "KEINE" ? verm : weit;
  return { ok: false, state, error: blockMessage(state) };
}

/** Kompakte Übersicht aller Zwecke (für die Profilanzeige). */
export async function candidateConsentSummary(
  candidateId: string
): Promise<Record<ConsentPurpose, ConsentState>> {
  const [profil, verm, weit] = await Promise.all([
    consentStateFor(candidateId, "PROFIL_SPEICHERN"),
    consentStateFor(candidateId, "VERMITTLUNG"),
    consentStateFor(candidateId, "WEITERGABE_AN_KUNDE"),
  ]);
  return {
    PROFIL_SPEICHERN: profil,
    VERMITTLUNG: verm,
    WEITERGABE_AN_KUNDE: weit,
  };
}
