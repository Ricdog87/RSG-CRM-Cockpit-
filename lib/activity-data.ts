import "server-only";
import { createClient } from "@/lib/supabase/server";
import { useMockData } from "@/lib/env";

export interface ActivityStats {
  callsToday: number;
  emailsToday: number;
  /** Wochenfokus (Mo–Do der laufenden Woche) je Linie. */
  week: {
    ki: { call: number; email: number };
    recruiting: { call: number; email: number };
  };
  /** Summen der laufenden Arbeitswoche (Mo–Do). */
  weekCalls: number;
  weekEmails: number;
  /** Tagessummen der letzten ~5 Wochen (für Streak & Wochenübersicht). */
  daily: Record<string, { call: number; email: number }>;
}

function dayKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function startOfWeek(): Date {
  const d = new Date();
  const day = (d.getDay() + 6) % 7; // Montag = 0
  d.setDate(d.getDate() - day);
  d.setHours(0, 0, 0, 0);
  return d;
}

const empty: ActivityStats = {
  callsToday: 0,
  emailsToday: 0,
  week: { ki: { call: 0, email: 0 }, recruiting: { call: 0, email: 0 } },
  weekCalls: 0,
  weekEmails: 0,
  daily: {},
};

/** Tages-, Wochen- & Verlaufsdaten (Calls/E-Mails) für die Tagesziele. */
export async function getActivityStats(): Promise<ActivityStats> {
  if (useMockData) return empty;
  try {
    const supabase = createClient();
    const since = new Date();
    since.setDate(since.getDate() - 40);
    const { data, error } = await supabase
      .from("activity_log")
      .select("kind, line, created_at")
      .gte("created_at", since.toISOString());
    if (error || !data) return empty;

    const todayKey = dayKey(new Date());
    const weekStart = startOfWeek();
    // Mo–Do (4 Arbeitstage) der laufenden Woche.
    const workDayKeys = new Set<string>();
    for (let i = 0; i < 4; i++) {
      const d = new Date(weekStart);
      d.setDate(weekStart.getDate() + i);
      workDayKeys.add(dayKey(d));
    }

    const out: ActivityStats = {
      callsToday: 0,
      emailsToday: 0,
      week: { ki: { call: 0, email: 0 }, recruiting: { call: 0, email: 0 } },
      weekCalls: 0,
      weekEmails: 0,
      daily: {},
    };

    for (const r of data as Array<{ kind: string; line: string; created_at: string }>) {
      const d = new Date(r.created_at);
      const key = dayKey(d);
      const isCall = r.kind === "call";
      const isEmail = r.kind === "email";
      if (!isCall && !isEmail) continue;

      const slot = out.daily[key] ?? { call: 0, email: 0 };
      if (isCall) slot.call += 1;
      else slot.email += 1;
      out.daily[key] = slot;

      if (key === todayKey) {
        if (isCall) out.callsToday += 1;
        else out.emailsToday += 1;
      }
      if (workDayKeys.has(key)) {
        const line = r.line === "ki" ? "ki" : "recruiting";
        if (isCall) {
          out.week[line].call += 1;
          out.weekCalls += 1;
        } else {
          out.week[line].email += 1;
          out.weekEmails += 1;
        }
      }
    }
    return out;
  } catch {
    return empty;
  }
}
