import { NextResponse } from "next/server";
import { syncHubspotProjects } from "@/lib/hubspot/sync";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Manuell triggerbarer, read-only HubSpot-Projekt-Sync.
 * POST /api/hubspot/sync-projects  → { ok, synced } | { ok:false, error, setup }
 *
 * Auth: läuft über die Partner-Session (Supabase-Cookies); ohne Session bricht
 * der Sync mit Fehler ab. Später per n8n/Cron auslösbar (dann mit einem
 * dedizierten Service-/Secret-Header absichern – siehe Doku).
 */
export async function POST() {
  const result = await syncHubspotProjects();
  return NextResponse.json(result, {
    status: result.ok ? 200 : 400,
    headers: { "Cache-Control": "no-store" },
  });
}
