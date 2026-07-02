import "server-only";
import { createClient } from "@/lib/supabase/server";
import { useMockData } from "@/lib/env";
import type { MatchStatus } from "@/lib/match-status";

/**
 * Lese-Statistiken über matches (Kandidat ↔ HubSpot-Projekt) fürs Dashboard.
 * RLS scoped auf den Partner (+ Downline).
 */
export interface MatchStats {
  /** Matches in Arbeit (VORGESCHLAGEN/GEPRUEFT/VORGESTELLT). */
  open: number;
  /** Neu angelegte Matches seit Wochenstart. */
  weekNew: number;
}

export async function getMatchStats(weekStartIso?: string): Promise<MatchStats> {
  if (useMockData) return { open: 0, weekNew: 0 };
  try {
    const supabase = createClient();
    const [openRes, weekRes] = await Promise.all([
      supabase
        .from("matches")
        .select("id", { count: "exact", head: true })
        .in("status", ["VORGESCHLAGEN", "GEPRUEFT", "VORGESTELLT"]),
      weekStartIso
        ? supabase
            .from("matches")
            .select("id", { count: "exact", head: true })
            .gte("created_at", weekStartIso)
        : Promise.resolve({ count: 0 } as { count: number | null }),
    ]);
    return { open: openRes.count ?? 0, weekNew: weekRes.count ?? 0 };
  } catch {
    return { open: 0, weekNew: 0 };
  }
}

export interface MatchRow {
  id: string;
  candidateId: string;
  candidateName: string;
  status: MatchStatus;
  score: number | null;
  vorgestelltAm: string | null;
  createdAt: string | null;
}

export interface ProjectMatchGroup {
  projectRefId: string;
  titel: string;
  kunde: string | null;
  hubspotDealId: string | null;
  /** Deeplink zum HubSpot-Deal (nur wenn HUBSPOT_PORTAL_ID gesetzt). */
  hubspotUrl: string | null;
  matches: MatchRow[];
}

type Row = Record<string, unknown>;
const str = (v: unknown): string | null => (v == null ? null : String(v));

/** Deeplink zum HubSpot-Deal (Objekt-Typ 0-3 = Deals). */
export function hubspotDealUrl(dealId: string | null): string | null {
  const portal = process.env.HUBSPOT_PORTAL_ID;
  if (!portal || !dealId) return null;
  return `https://app.hubspot.com/contacts/${portal}/record/0-3/${dealId}`;
}

/**
 * Alle laufenden Matches, gruppiert nach HubSpot-Projekt (für die
 * Match-Pipeline auf /cockpit/match). RLS: eigener Partner + Downline.
 */
export async function getMatchesOverview(): Promise<ProjectMatchGroup[]> {
  if (useMockData) return [];
  try {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("matches")
      .select(
        "id, status, score, vorgestellt_am, created_at, candidate_id, project_ref_id, candidates(name), project_refs(titel, kunde, hubspot_deal_id)"
      )
      .order("created_at", { ascending: false })
      .limit(500);
    if (error || !data) return [];

    const groups = new Map<string, ProjectMatchGroup>();
    for (const r of data as Row[]) {
      const pid = String(r.project_ref_id);
      const proj = (r.project_refs as Row | null) ?? {};
      let g = groups.get(pid);
      if (!g) {
        const dealId = str(proj.hubspot_deal_id);
        g = {
          projectRefId: pid,
          titel: str(proj.titel) ?? "Projekt",
          kunde: str(proj.kunde),
          hubspotDealId: dealId,
          hubspotUrl: hubspotDealUrl(dealId),
          matches: [],
        };
        groups.set(pid, g);
      }
      const cand = (r.candidates as Row | null) ?? {};
      g.matches.push({
        id: String(r.id),
        candidateId: String(r.candidate_id),
        candidateName: str(cand.name) ?? "—",
        status: (str(r.status) ?? "VORGESCHLAGEN") as MatchStatus,
        score: r.score != null ? Number(r.score) : null,
        vorgestelltAm: str(r.vorgestellt_am),
        createdAt: str(r.created_at),
      });
    }
    return Array.from(groups.values());
  } catch {
    return [];
  }
}

export interface CandidateMatchRow {
  id: string;
  projectRefId: string;
  titel: string;
  kunde: string | null;
  status: MatchStatus;
  hubspotUrl: string | null;
}

/** Matches einer:s Kandidat:in (fürs Profil). */
export async function getMatchesForCandidate(candidateId: string): Promise<CandidateMatchRow[]> {
  if (useMockData) return [];
  try {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("matches")
      .select("id, status, project_ref_id, project_refs(titel, kunde, hubspot_deal_id)")
      .eq("candidate_id", candidateId)
      .order("created_at", { ascending: false })
      .limit(50);
    if (error || !data) return [];
    return (data as Row[]).map((r) => {
      const proj = (r.project_refs as Row | null) ?? {};
      return {
        id: String(r.id),
        projectRefId: String(r.project_ref_id),
        titel: str(proj.titel) ?? "Projekt",
        kunde: str(proj.kunde),
        status: (str(r.status) ?? "VORGESCHLAGEN") as MatchStatus,
        hubspotUrl: hubspotDealUrl(str(proj.hubspot_deal_id)),
      };
    });
  } catch {
    return [];
  }
}
