import "server-only";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient, hasServiceRole } from "@/lib/supabase/service";
import { useMockData } from "@/lib/env";

/** Eine DSGVO-Einwilligung (Datensatz aus candidate_consents). */
export interface Consent {
  id: string;
  candidate_id: string;
  token: string;
  status: "pending" | "granted" | "revoked";
  zweck: string | null;
  text_version: string;
  email_to: string | null;
  sent_at: string | null;
  granted_at: string | null;
  revoked_at: string | null;
  expires_at: string | null;
}

export interface ConsentWithCandidate extends Consent {
  candidate_name: string;
}

type Row = Record<string, unknown>;
const str = (v: unknown): string | null => (v == null ? null : String(v));

function mapConsent(r: Row): Consent {
  return {
    id: String(r.id),
    candidate_id: String(r.candidate_id),
    token: String(r.token),
    status: (String(r.status || "pending") as Consent["status"]),
    zweck: str(r.zweck),
    text_version: String(r.text_version || ""),
    email_to: str(r.email_to),
    sent_at: str(r.sent_at),
    granted_at: str(r.granted_at),
    revoked_at: str(r.revoked_at),
    expires_at: str(r.expires_at),
  };
}

/** Neueste Einwilligung einer:s Kandidat:in (RLS: eigene Daten). */
export async function getConsentForCandidate(candidateId: string): Promise<Consent | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("candidate_consents")
    .select("*")
    .eq("candidate_id", candidateId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error || !data) return null;
  return mapConsent(data as Row);
}

export interface ConsentRow extends Consent {
  candidate_name: string;
  candidate_email: string | null;
}

/** Alle Einwilligungen der:des Partner:in (+ Downline) für die Übersicht. */
export async function getConsents(): Promise<ConsentRow[]> {
  if (useMockData) return [];
  try {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("candidate_consents")
      .select("*, candidates(name, email)")
      .order("created_at", { ascending: false })
      .limit(500);
    if (error || !data) return [];
    // Append-only: pro (Kandidat, Zweck) nur den jüngsten Record zeigen
    // (data ist created_at desc → erster Treffer je Schlüssel gewinnt).
    const seen = new Set<string>();
    const rows: ConsentRow[] = [];
    for (const r of data as Row[]) {
      const key = `${String(r.candidate_id)}|${r.zweck == null ? "" : String(r.zweck)}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const cand = (r.candidates as { name?: string; email?: string } | null) ?? null;
      rows.push({
        ...mapConsent(r),
        candidate_name: cand?.name ? String(cand.name) : "—",
        candidate_email: cand?.email ? String(cand.email) : null,
      });
    }
    return rows;
  } catch {
    return [];
  }
}

/**
 * Rohe Consent-Aktivität ab `sinceIso` (für Dashboard-Kennzahlen/Tagesziele).
 * Keine Dedupe – jede Anfrage/Erteilung zählt.
 */
export async function getRecentConsents(
  sinceIso: string
): Promise<{ created_at: string | null; status: string; granted_at: string | null }[]> {
  if (useMockData) return [];
  try {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("candidate_consents")
      .select("created_at, status, granted_at")
      .gte("created_at", sinceIso)
      .order("created_at", { ascending: false })
      .limit(2000);
    if (error || !data) return [];
    return (data as Row[]).map((r) => ({
      created_at: str(r.created_at),
      status: String(r.status ?? "pending"),
      granted_at: str(r.granted_at),
    }));
  } catch {
    return [];
  }
}

/**
 * Einwilligung per öffentlichem Token laden (für die /einwilligung-Seite).
 * Läuft über den Service-Role-Client, da der/die Kandidat:in nicht eingeloggt ist.
 */
export async function getConsentByToken(token: string): Promise<ConsentWithCandidate | null> {
  if (!hasServiceRole()) return null;
  const svc = createServiceClient();
  const { data, error } = await svc
    .from("candidate_consents")
    .select("*, candidates(name)")
    .eq("token", token)
    .maybeSingle();
  if (error || !data) return null;
  const row = data as Row;
  const cand = (row.candidates as { name?: string } | null) ?? null;
  return { ...mapConsent(row), candidate_name: cand?.name ? String(cand.name) : "" };
}
