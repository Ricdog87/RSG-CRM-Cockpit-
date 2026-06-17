import "server-only";
import { createClient } from "@/lib/supabase/server";
import { useMockData } from "@/lib/env";

export interface ActivityStats {
  callsToday: number;
  emailsToday: number;
  // Wochenfokus (laufende Woche, ab Montag) je Linie.
  week: {
    ki: { call: number; email: number };
    recruiting: { call: number; email: number };
  };
}

function startOfTodayISO(): string {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}
function startOfWeekISO(): string {
  const d = new Date();
  const day = (d.getDay() + 6) % 7; // Montag = 0
  d.setDate(d.getDate() - day);
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

const empty: ActivityStats = {
  callsToday: 0,
  emailsToday: 0,
  week: { ki: { call: 0, email: 0 }, recruiting: { call: 0, email: 0 } },
};

/** Tages- & Wochen-Aktivitäten (Calls/E-Mails) für die Tagesziele. */
export async function getActivityStats(): Promise<ActivityStats> {
  if (useMockData) return empty;
  try {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("activity_log")
      .select("kind, line, created_at")
      .gte("created_at", startOfWeekISO());
    if (error || !data) return empty;

    const today = startOfTodayISO();
    const out: ActivityStats = {
      callsToday: 0,
      emailsToday: 0,
      week: { ki: { call: 0, email: 0 }, recruiting: { call: 0, email: 0 } },
    };
    for (const r of data as Array<{ kind: string; line: string; created_at: string }>) {
      const line = r.line === "ki" ? "ki" : "recruiting";
      if (r.kind === "call") out.week[line].call += 1;
      else if (r.kind === "email") out.week[line].email += 1;
      if (r.created_at >= today) {
        if (r.kind === "call") out.callsToday += 1;
        else if (r.kind === "email") out.emailsToday += 1;
      }
    }
    return out;
  } catch {
    return empty;
  }
}
