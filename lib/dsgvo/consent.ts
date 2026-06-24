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

  // Jüngsten Record für diesen Zweck wählen (Append-only: created_at desc).
  // Bestandsdaten ohne zweck zählen nur für PROFIL_SPEICHERN.
  const rec = (data as ConsentRowLite[]).find(
    (r) => r.zweck === purpose || (r.zweck == null && purpose === "PROFIL_SPEICHERN")
  );
  if (!rec) return "KEINE";

  if (rec.status === "revoked" || rec.revoked_at) return "WIDERRUFEN";
  if (rec.status !== "granted") return "KEINE"; // pending o.ä.
  if (rec.expires_at && new Date(rec.expires_at).getTime() < Date.now()) return "ABGELAUFEN";
  return "ERTEILT";
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
