import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import {
  getValidAccessToken,
  upsertGoogleEvent,
  deleteGoogleEvent,
} from "@/lib/google-calendar";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface SyncBody {
  taskId: string;
  /** "upsert" (default) oder "delete" wenn Task erledigt/gelöscht */
  action?: "upsert" | "delete";
}

/**
 * POST /api/google/sync
 *
 * Synchronisiert einen einzelnen CRM-Task nach Google Calendar.
 * Body: { taskId: string, action?: "upsert" | "delete" }
 *
 * Wird aufgerufen:
 *  - Automatisch aus crm-actions.ts nach addTask()
 *  - Optional manuell über "🔄 Sync"-Button in der UI
 *
 * Gibt { ok: false, reason: "not_connected" } zurück wenn kein
 * Google-Token vorhanden — kein Fehler, nur kein Sync.
 */
export async function POST(req: Request) {
  // ── Google-Verbindung prüfen ───────────────────────────────────────
  const auth = await getValidAccessToken();
  if (!auth) {
    return NextResponse.json({ ok: false, reason: "not_connected" });
  }

  // ── Request-Body parsen ────────────────────────────────────────────
  let body: SyncBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, reason: "invalid_body" }, { status: 400 });
  }

  const { taskId, action = "upsert" } = body;
  if (!taskId) {
    return NextResponse.json({ ok: false, reason: "missing_taskId" }, { status: 400 });
  }

  const svc = createServiceClient();

  // ── Task aus DB laden (RLS via Service-Role + Partner-Check) ───────
  const { data: task } = await svc
    .from("crm_tasks")
    .select("id, title, notes, related_label, due_date, due_time, google_event_id, done")
    .eq("id", taskId)
    .eq("partner_id", auth.partnerId)
    .maybeSingle();

  if (!task) {
    return NextResponse.json({ ok: false, reason: "task_not_found" }, { status: 404 });
  }

  const t = task as {
    id: string;
    title: string;
    notes: string | null;
    related_label: string | null;
    due_date: string | null;
    due_time: string | null;
    google_event_id: string | null;
    done: boolean;
  };

  // ── Delete-Pfad (Task erledigt oder gelöscht) ──────────────────────
  if (action === "delete" && t.google_event_id) {
    await deleteGoogleEvent(auth.token, t.google_event_id, auth.calendarId);
    await svc
      .from("crm_tasks")
      .update({ google_event_id: null })
      .eq("id", taskId);
    return NextResponse.json({ ok: true, action: "deleted" });
  }

  // ── Upsert-Pfad ────────────────────────────────────────────────────
  if (!t.due_date) {
    // Tasks ohne Fälligkeit können nicht als Calendar-Event angelegt werden.
    return NextResponse.json({ ok: false, reason: "no_due_date" });
  }

  const eventId = await upsertGoogleEvent(
    auth.token,
    {
      id: t.id,
      title: t.title,
      notes: t.notes,
      related_label: t.related_label,
      due_date: t.due_date,
      due_time: t.due_time,
    },
    t.google_event_id,
    auth.calendarId
  );

  if (!eventId) {
    return NextResponse.json({ ok: false, reason: "google_api_error" }, { status: 502 });
  }

  // Neue Event-ID in DB zurückschreiben (nur wenn sich die ID geändert hat).
  if (eventId !== t.google_event_id) {
    await svc
      .from("crm_tasks")
      .update({ google_event_id: eventId })
      .eq("id", taskId);
  }

  return NextResponse.json({ ok: true, eventId, action: "upserted" });
}
