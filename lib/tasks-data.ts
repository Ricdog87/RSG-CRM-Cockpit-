import "server-only";
import { createClient } from "@/lib/supabase/server";
import { useMockData } from "@/lib/env";

export interface Task {
  id: string;
  title: string;
  due_date: string | null;
  done: boolean;
  created_at: string;
  account_id?: string;
  account_name?: string;
}

/** Aufgaben zu einem Account (offene zuerst, nach Fälligkeit). */
export async function getTasksForAccount(accountId: string): Promise<Task[]> {
  if (useMockData) return mockTasks.map((t) => ({ ...t, account_id: accountId }));
  try {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("account_tasks")
      .select("id, title, due_date, done, created_at")
      .eq("account_id", accountId)
      .order("done", { ascending: true })
      .order("due_date", { ascending: true, nullsFirst: false })
      .limit(100);
    if (error) return [];
    return ((data as Array<Record<string, unknown>>) ?? []).map(mapTask);
  } catch {
    return [];
  }
}

/** Alle offenen Aufgaben der:des Partner:in (mit Account-Name). */
export async function getOpenTasks(): Promise<Task[]> {
  if (useMockData) {
    return mockTasks
      .filter((t) => !t.done)
      .map((t, i) => ({
        ...t,
        account_id: `demo-${i}`,
        account_name: ["Hofmann Dental MVZ", "Logistik Brendel GmbH"][i % 2],
      }));
  }
  try {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("account_tasks")
      .select("id, title, due_date, done, created_at, account_id, accounts(name)")
      .eq("done", false)
      .order("due_date", { ascending: true, nullsFirst: false })
      .limit(200);
    if (error) return [];
    return ((data as Array<Record<string, unknown>>) ?? []).map((r) => ({
      ...mapTask(r),
      account_id: String(r.account_id ?? ""),
      account_name: (r.accounts as { name?: string } | null)?.name ?? "Account",
    }));
  } catch {
    return [];
  }
}

function mapTask(r: Record<string, unknown>): Task {
  return {
    id: String(r.id),
    title: String(r.title ?? ""),
    due_date: (r.due_date as string | null) ?? null,
    done: Boolean(r.done),
    created_at: String(r.created_at ?? ""),
  };
}

const mockTasks: Task[] = [
  { id: "t1", title: "Angebot nachfassen", due_date: "2026-06-15", done: false, created_at: "2026-06-11T10:00:00Z" },
  { id: "t2", title: "Demo-Termin bestätigen", due_date: "2026-06-13", done: false, created_at: "2026-06-10T10:00:00Z" },
  { id: "t3", title: "Vertrag versendet", due_date: null, done: true, created_at: "2026-06-08T10:00:00Z" },
];
