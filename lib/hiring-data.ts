import "server-only";
import { createClient } from "@/lib/supabase/server";
import { useMockData } from "@/lib/env";
import type {
  Interview,
  InterviewStatus,
  InterviewType,
  Offer,
  OfferStatus,
} from "@/lib/crm-types";

type Row = Record<string, unknown>;
const str = (v: unknown): string => (v == null ? "" : String(v));
const num = (v: unknown): number | undefined => (v == null ? undefined : Number(v));

function mapInterview(r: Row): Interview {
  return {
    id: str(r.id),
    candidate_id: str(r.candidate_id),
    mandate_id: str(r.mandate_id) || undefined,
    scheduled_at: str(r.scheduled_at) || undefined,
    type: (str(r.type) || "telefon") as InterviewType,
    interviewer: str(r.interviewer) || undefined,
    location: str(r.location) || undefined,
    status: (str(r.status) || "geplant") as InterviewStatus,
    score: num(r.score),
    feedback: str(r.feedback) || undefined,
    created_at: str(r.created_at) || undefined,
  };
}

function mapOffer(r: Row): Offer {
  return {
    id: str(r.id),
    candidate_id: str(r.candidate_id),
    mandate_id: str(r.mandate_id) || undefined,
    offered_salary: num(r.offered_salary),
    start_date: str(r.start_date) || undefined,
    offer_date: str(r.offer_date) || undefined,
    status: (str(r.status) || "entwurf") as OfferStatus,
    decline_reason: str(r.decline_reason) || undefined,
    notes: str(r.notes) || undefined,
    created_at: str(r.created_at) || undefined,
  };
}

/** Interviews einer:s Kandidat:in (neueste zuerst). */
export async function getInterviewsForCandidate(candidateId: string): Promise<Interview[]> {
  if (useMockData) return [];
  try {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("candidate_interviews")
      .select("*")
      .eq("candidate_id", candidateId)
      .order("scheduled_at", { ascending: false });
    if (error || !data) return [];
    return (data as Row[]).map(mapInterview);
  } catch {
    return [];
  }
}

/** Angebote einer:s Kandidat:in (neueste zuerst). */
export async function getOffersForCandidate(candidateId: string): Promise<Offer[]> {
  if (useMockData) return [];
  try {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("candidate_offers")
      .select("*")
      .eq("candidate_id", candidateId)
      .order("created_at", { ascending: false });
    if (error || !data) return [];
    return (data as Row[]).map(mapOffer);
  } catch {
    return [];
  }
}
