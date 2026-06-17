import "server-only";
import { createServiceClient, hasServiceRole } from "@/lib/supabase/service";

export interface PublicJob {
  role: string;
  job_posting?: string;
  job_posting_anonymized?: string;
  status: string;
}

/**
 * Öffentliche Stellen-Daten per Teilen-Token (kein Login).
 * Läuft über den Service-Role-Client, da Kandidat:innen nicht eingeloggt sind.
 */
export async function getJobByShareToken(token: string): Promise<PublicJob | null> {
  if (!token || !hasServiceRole()) return null;
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("recruiting_mandates")
    .select("role, job_posting, job_posting_anonymized, status")
    .eq("share_token", token)
    .maybeSingle();
  if (error || !data) return null;
  const r = data as Record<string, unknown>;
  return {
    role: String(r.role ?? "Position"),
    job_posting: r.job_posting ? String(r.job_posting) : undefined,
    job_posting_anonymized: r.job_posting_anonymized ? String(r.job_posting_anonymized) : undefined,
    status: String(r.status ?? "offen"),
  };
}
