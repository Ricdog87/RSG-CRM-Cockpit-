import "server-only";
import { createClient } from "@/lib/supabase/server";
import { useMockData } from "@/lib/env";
import type { RelatedType } from "@/lib/task-link";

export interface Task {
  id: string;
  related_type: RelatedType;
  related_id: string | null;
  related_label: string | null;
  title: string;
  notes: string | null;
  due_date: string | null;
  due_time: string | null;
  done: boolean;
}

function mapTask(r: Record<string, unknown>): Task {
  return {
    id: String(r.id),
    related_type: (r.related_type as RelatedType) ?? "none",
    related_id: (r.related_id as string | null) ?? null,
    related_label: (r.related_label as string | null) ?? null,
    title: String(r.title ?? ""),
    notes: (r.notes as string | null) ?? null,
    due_date: (r.due_date as string | null) ?? null,
    due_time: (r.due_time as string | null) ?? null,
    done: Boolean(r.done),
  };
}

const SELECT =
  "id, related_type, related_id, related_label, title, notes, due_date, due_time, done";

/** Aufgaben/Termine zu einem verknüpften Datensatz. */
export async function getTasksForRelated(
  type: RelatedType,
  id: string
): Promise<Task[]> {
  if (useMockData)
    return mockTasks.filter((t) => t.related_type === type && t.related_id === id);
  try {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("crm_tasks")
      .select(SELECT)
      .eq("related_type", type)
      .eq("related_id", id)
      .order("done", { ascending: true })
      .order("due_date", { ascending: true, nullsFirst: false })
      .limit(100);
    if (error) return [];
    return ((data as Array<Record<string, unknown>>) ?? []).map(mapTask);
  } catch {
    return [];
  }
}

/** Alle offenen Aufgaben/Termine der:des Partner:in. */
export async function getOpenTasks(): Promise<Task[]> {
  if (useMockData) return mockTasks.filter((t) => !t.done);
  try {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("crm_tasks")
      .select(SELECT)
      .eq("done", false)
      .order("due_date", { ascending: true, nullsFirst: false })
      .limit(300);
    if (error) return [];
    return ((data as Array<Record<string, unknown>>) ?? []).map(mapTask);
  } catch {
    return [];
  }
}

/** Datierte Aufgaben/Termine für die Kalenderansicht. */
export async function getCalendarTasks(): Promise<Task[]> {
  if (useMockData) return mockTasks.filter((t) => t.due_date);
  try {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("crm_tasks")
      .select(SELECT)
      .not("due_date", "is", null)
      .order("due_date", { ascending: true })
      .limit(500);
    if (error) return [];
    return ((data as Array<Record<string, unknown>>) ?? []).map(mapTask);
  } catch {
    return [];
  }
}

function randomToken(): string {
  const c = globalThis.crypto;
  if (c?.randomUUID) return c.randomUUID().replace(/-/g, "").slice(0, 18);
  return Math.random().toString(36).slice(2, 18);
}

/** Persönliches Kalender-Token für den ICS-Abo-Link (lazy angelegt). */
export async function getCalendarToken(): Promise<{ token: string; demo: boolean }> {
  if (useMockData) return { token: "demo", demo: true };
  try {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { token: "", demo: false };
    const { data: partner } = await supabase
      .from("partners")
      .select("id")
      .eq("auth_user_id", user.id)
      .single();
    if (!partner) return { token: "", demo: false };

    const { data: existing } = await supabase
      .from("calendar_tokens")
      .select("token")
      .eq("partner_id", partner.id)
      .maybeSingle();
    let token = existing?.token as string | undefined;
    if (!token) {
      token = randomToken();
      await supabase.from("calendar_tokens").insert({ partner_id: partner.id, token });
    }
    return { token, demo: false };
  } catch {
    return { token: "", demo: false };
  }
}

// Demo-Datensätze (Juni 2026, rund um „heute" = 14.06.2026).
const mockTasks: Task[] = [
  { id: "t1", related_type: "customer", related_id: "c-1", related_label: "Hofmann Dental MVZ", title: "Angebot nachfassen", notes: null, due_date: "2026-06-15", due_time: "10:00", done: false },
  { id: "t2", related_type: "candidate", related_id: "cand-1", related_label: "Anna Decker", title: "Interview vorbereiten", notes: null, due_date: "2026-06-16", due_time: "14:30", done: false },
  { id: "t3", related_type: "project", related_id: "p-1", related_label: "Logistik Brendel · AI Scale", title: "Go-Live-Call", notes: null, due_date: "2026-06-18", due_time: "11:00", done: false },
  { id: "t4", related_type: "customer", related_id: "c-2", related_label: "Praxis Dr. Vogt", title: "Demo-Termin", notes: null, due_date: "2026-06-12", due_time: "09:00", done: false },
  { id: "t5", related_type: "none", related_id: null, related_label: null, title: "Wochenplanung", notes: null, due_date: "2026-06-14", due_time: null, done: false },
];
