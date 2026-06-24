import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { syncHubspotProjects, syncHubspotProjectsForAllPartners } from "@/lib/hubspot/sync";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Manuell triggerbarer, read-only HubSpot-Projekt-Sync.
 * POST /api/hubspot/sync-projects  → { ok, synced } | { ok:false, error, setup }
 *
 * Zwei Pfade:
 *  - Partner-Session (Cockpit-UI): ohne Header → Sync für den eingeloggten Partner.
 *  - Cron/n8n: Header `x-sync-secret: <SYNC_CRON_SECRET>` → Sync für ALLE Partner
 *    via Service-Role (keine Session nötig). Ist SYNC_CRON_SECRET nicht gesetzt,
 *    ist der Cron-Pfad deaktiviert.
 */
export async function POST() {
  const secret = process.env.SYNC_CRON_SECRET;
  const provided = headers().get("x-sync-secret");
  const isCron = Boolean(secret) && provided === secret;

  const result = isCron ? await syncHubspotProjectsForAllPartners() : await syncHubspotProjects();
  return NextResponse.json(result, {
    status: result.ok ? 200 : 400,
    headers: { "Cache-Control": "no-store" },
  });
}
