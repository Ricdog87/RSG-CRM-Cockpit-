import "server-only";
import { createClient } from "@/lib/supabase/server";
import { useMockData } from "@/lib/env";

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
