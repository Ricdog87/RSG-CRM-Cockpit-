import "server-only";
import { createClient } from "@/lib/supabase/server";
import { useMockData } from "@/lib/env";
import type { CandidateReference, ReferenceStatus } from "@/lib/crm-types";

type Row = Record<string, unknown>;
const str = (v: unknown): string => (v == null ? "" : String(v));

function mapRef(r: Row): CandidateReference {
  return {
    id: str(r.id),
    candidate_id: str(r.candidate_id),
    referee_name: str(r.referee_name) || undefined,
    relationship: str(r.relationship) || undefined,
    contact: str(r.contact) || undefined,
    status: (str(r.status) || "angefragt") as ReferenceStatus,
    feedback: str(r.feedback) || undefined,
    created_at: str(r.created_at) || undefined,
  };
}

/** Referenzen einer:s Kandidat:in (neueste zuerst). */
export async function getReferencesForCandidate(candidateId: string): Promise<CandidateReference[]> {
  if (useMockData) return [];
  try {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("candidate_references")
      .select("*")
      .eq("candidate_id", candidateId)
      .order("created_at", { ascending: false });
    if (error || !data) return [];
    return (data as Row[]).map(mapRef);
  } catch {
    return [];
  }
}
