import { NextResponse } from "next/server";
import { createServiceClient, hasServiceRole } from "@/lib/supabase/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Read-only ICS-Feed für Kalender-Abos (Google/Outlook „Per URL hinzufügen").
 * Token identifiziert die:den Partner:in. Lesen via Service-Role (kein Login
 * im Abo-Request). Ohne Service-Role → Demo-Kalender.
 */

function esc(s: string): string {
  return (s || "")
    .replace(/\\/g, "\\\\")
    .replace(/\n/g, "\\n")
    .replace(/,/g, "\\,")
    .replace(/;/g, "\\;");
}

function dtStart(due_date: string, due_time?: string | null): string {
  const date = due_date.slice(0, 10).replace(/-/g, "");
  if (due_time) {
    const t = due_time.replace(/:/g, "").padEnd(4, "0").slice(0, 4);
    return `DTSTART:${date}T${t}00`;
  }
  return `DTSTART;VALUE=DATE:${date}`;
}

interface Row {
  id: string;
  title?: string;
  notes?: string | null;
  related_label?: string | null;
  due_date?: string | null;
  due_time?: string | null;
}

function buildIcs(rows: Row[]): string {
  const stamp = new Date().toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//RSG CRM//Kalender//DE",
    "CALSCALE:GREGORIAN",
    "X-WR-CALNAME:RSG CRM",
  ];
  for (const r of rows) {
    if (!r.due_date) continue;
    const desc = [r.related_label, r.notes].filter(Boolean).join(" — ");
    lines.push(
      "BEGIN:VEVENT",
      `UID:${r.id}@rsg-crm`,
      `DTSTAMP:${stamp}`,
      dtStart(r.due_date, r.due_time),
      `SUMMARY:${esc(r.title ?? "Aufgabe")}`,
      ...(desc ? [`DESCRIPTION:${esc(desc)}`] : []),
      "END:VEVENT"
    );
  }
  lines.push("END:VCALENDAR");
  return lines.join("\r\n");
}

const DEMO_ROWS: Row[] = [
  { id: "demo1", title: "Angebot nachfassen", related_label: "Hofmann Dental MVZ", due_date: "2026-06-15", due_time: "10:00" },
  { id: "demo2", title: "Interview vorbereiten", related_label: "Anna Decker", due_date: "2026-06-16", due_time: "14:30" },
];

function icsResponse(body: string) {
  return new NextResponse(body, {
    status: 200,
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Cache-Control": "public, max-age=300",
    },
  });
}

export async function GET(
  _req: Request,
  { params }: { params: { token: string } }
) {
  const token = params.token.replace(/\.ics$/, "");

  if (!hasServiceRole() || token === "demo") {
    return icsResponse(buildIcs(DEMO_ROWS));
  }

  const svc = createServiceClient();
  const { data: row } = await svc
    .from("calendar_tokens")
    .select("partner_id")
    .eq("token", token)
    .maybeSingle();
  if (!row) return icsResponse(buildIcs([]));

  const { data: tasks } = await svc
    .from("crm_tasks")
    .select("id, title, notes, related_label, due_date, due_time")
    .eq("partner_id", (row as { partner_id: string }).partner_id)
    .not("due_date", "is", null)
    .limit(1000);

  return icsResponse(buildIcs((tasks as Row[]) ?? []));
}
