import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient, hasServiceRole } from "@/lib/supabase/service";
import { googleConfigured, buildRedirectUri, buildAuthUrl } from "@/lib/google-calendar";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/google/connect
 *
 * Startet den Google-OAuth-Flow:
 *   1. Prüft ob ENV-Vars konfiguriert sind
 *   2. Ermittelt die Partner-ID (für den state-Parameter)
 *   3. Leitet zur Google-Consent-Page weiter
 *
 * Voraussetzung: Eingeloggter User (Cookie-Session).
 */
export async function GET(req: Request) {
  const origin = new URL(req.url).origin;

  // ── Konfigurationsprüfung ──────────────────────────────────────────
  if (!googleConfigured() || !hasServiceRole()) {
    return NextResponse.redirect(
      `${origin}/cockpit/kalender?google_error=not_configured`
    );
  }

  // ── User-Session prüfen ────────────────────────────────────────────
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.redirect(`${origin}/cockpit/login`);
  }

  // ── Partner-ID für state-Parameter ────────────────────────────────
  const svc = createServiceClient();
  const { data: partner } = await svc
    .from("partners")
    .select("id")
    .eq("auth_user_id", user.id)
    .single();

  if (!partner) {
    return NextResponse.redirect(
      `${origin}/cockpit/kalender?google_error=no_partner`
    );
  }

  const redirectUri = buildRedirectUri(origin);
  const authUrl = buildAuthUrl(redirectUri, (partner as { id: string }).id);

  return NextResponse.redirect(authUrl);
}
