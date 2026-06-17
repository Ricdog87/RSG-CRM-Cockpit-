import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient, hasServiceRole } from "@/lib/supabase/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/google/disconnect
 *
 * Entfernt das Google-Token des eingeloggten Partners aus der DB.
 * Bestehende Google-Events bleiben in Google Calendar erhalten
 * (kein Löschen auf Google-Seite — das würde Nutzer-Daten verändern).
 */
export async function POST(_req: Request) {
  if (!hasServiceRole()) {
    return NextResponse.json(
      { ok: false, error: "Service role not configured" },
      { status: 503 }
    );
  }

  // ── User-Session prüfen ────────────────────────────────────────────
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const svc = createServiceClient();

  // ── Partner-ID des Users ───────────────────────────────────────────
  const { data: partner } = await svc
    .from("partners")
    .select("id")
    .eq("auth_user_id", user.id)
    .single();
  if (!partner) {
    return NextResponse.json({ ok: false, error: "No partner" }, { status: 404 });
  }

  // ── Token löschen ──────────────────────────────────────────────────
  const { error } = await svc
    .from("google_calendar_tokens")
    .delete()
    .eq("partner_id", (partner as { id: string }).id);

  if (error) {
    console.error("[google/disconnect]", error);
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
