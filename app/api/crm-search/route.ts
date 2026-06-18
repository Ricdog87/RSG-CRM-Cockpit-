import { NextResponse } from "next/server";
import { runCrmSearch } from "@/lib/crm-search";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Sitzungsgebundene CRM-Suche für die Command-Palette (⌘K).
 * Auth läuft implizit über die Supabase-Session-Cookies der crm-data-Layer –
 * kein eigenes Secret nötig, da nur die eigenen Daten sichtbar sind.
 *
 * GET /api/crm-search?q=...  → { groups, total }
 */
export async function GET(req: Request) {
  const q = new URL(req.url).searchParams.get("q") ?? "";
  if (q.trim().length < 2) {
    return NextResponse.json({ groups: [], total: 0 });
  }
  try {
    const result = await runCrmSearch(q, 6);
    return NextResponse.json(result, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch {
    return NextResponse.json({ groups: [], total: 0 }, { status: 200 });
  }
}
