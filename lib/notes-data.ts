import "server-only";
import { createClient } from "@/lib/supabase/server";
import { useMockData } from "@/lib/env";

export interface Note {
  id: string;
  body: string;
  created_at: string;
}

/** Notizen zu einem Account (neueste zuerst). */
export async function getNotesForAccount(accountId: string): Promise<Note[]> {
  if (useMockData) return mockNotes;
  try {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("account_notes")
      .select("id, body, created_at")
      .eq("account_id", accountId)
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) return [];
    return ((data as Array<Record<string, unknown>>) ?? []).map((r) => ({
      id: String(r.id),
      body: String(r.body ?? ""),
      created_at: String(r.created_at ?? ""),
    }));
  } catch {
    return [];
  }
}

const mockNotes: Note[] = [
  {
    id: "n1",
    body: "Entscheider ist der Inhaber. Schmerzpunkt: verpasste Anrufe in der Mittagspause. Pilot AI Account Manager angeboten.",
    created_at: "2026-06-11T10:30:00Z",
  },
  {
    id: "n2",
    body: "Zweite offene Stelle (KFZ-Mechatroniker) – Recruiting-Mandat angesprochen, Angebot folgt.",
    created_at: "2026-06-09T15:10:00Z",
  },
];
