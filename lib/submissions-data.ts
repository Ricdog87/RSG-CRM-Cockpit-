import "server-only";
import { createClient } from "@/lib/supabase/server";
import { useMockData } from "@/lib/env";
import { logDataError, isMissingTable } from "@/lib/log";

export interface Submission {
  id: string;
  candidate_id: string;
  mandate_id: string | null;
  account_name: string;
  role: string;
  stage: string;
  created_at: string;
}

/** Vorstellungs-/Bewerbungshistorie einer:s Kandidat:in (neueste zuerst). */
export async function getSubmissionsForCandidate(candidateId: string): Promise<Submission[]> {
  if (useMockData) return [];
  try {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("candidate_submissions")
      .select("*")
      .eq("candidate_id", candidateId)
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) {
      if (!isMissingTable(error)) logDataError("submissions:candidate", error);
      return [];
    }
    return ((data as Array<Record<string, unknown>>) ?? []).map((r) => ({
      id: String(r.id),
      candidate_id: String(r.candidate_id),
      mandate_id: (r.mandate_id as string | null) ?? null,
      account_name: String(r.account_name ?? ""),
      role: String(r.role ?? ""),
      stage: String(r.stage ?? "vorgestellt"),
      created_at: String(r.created_at ?? ""),
    }));
  } catch (e) {
    logDataError("submissions:candidate", e);
    return [];
  }
}
