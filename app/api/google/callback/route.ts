import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { exchangeCode, buildRedirectUri } from "@/lib/google-calendar";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/google/callback
 *
 * Google leitet hierher nach der Nutzer-Zustimmung weiter.
 * Query-Parameter von Google:
 *   code  — Authorization Code (einmalig, kurzlebig)
 *   state — partnerId (aus /api/google/connect übergeben)
 *   error — z.B. "access_denied" wenn Nutzer ablehnt
 *
 * Ablauf:
 *   1. Code gegen Tokens tauschen
 *   2. Tokens in google_calendar_tokens speichern (Upsert)
 *   3. Zurück zur Kalender-Seite mit ?google_connected=1
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state"); // = partnerId
  const error = url.searchParams.get("error");
  const base = url.origin;

  // ── Fehler von Google (z.B. Nutzer hat abgebrochen) ───────────────
  if (error) {
    return NextResponse.redirect(
      `${base}/cockpit/kalender?google_error=${encodeURIComponent(error)}`
    );
  }

  if (!code || !state) {
    return NextResponse.redirect(
      `${base}/cockpit/kalender?google_error=missing_params`
    );
  }

  try {
    // ── Code gegen Tokens tauschen ─────────────────────────────────
    const redirectUri = buildRedirectUri(base);
    const tokens = await exchangeCode(code, redirectUri);

    // refresh_token ist nur beim ERSTEN Verbinden vorhanden
    // (danach nur wenn prompt=consent, was wir in buildAuthUrl setzen).
    if (!tokens.refresh_token) {
      // Sollte nicht passieren (prompt=consent erzwingt refresh_token),
      // aber als Safety-Net abfangen.
      return NextResponse.redirect(
        `${base}/cockpit/kalender?google_error=no_refresh_token`
      );
    }

    const expiresAt = new Date(Date.now() + tokens.expires_in * 1000);

    // ── Tokens speichern (Upsert: überschreibt bestehende Verbindung) ─
    const svc = createServiceClient();
    const { error: dbErr } = await svc
      .from("google_calendar_tokens")
      .upsert(
        {
          partner_id: state,
          access_token: tokens.access_token,
          refresh_token: tokens.refresh_token,
          expires_at: expiresAt.toISOString(),
          updated_at: new Date().toISOString(),
        },
        { onConflict: "partner_id" }
      );

    if (dbErr) throw dbErr;

    return NextResponse.redirect(
      `${base}/cockpit/kalender?google_connected=1`
    );
  } catch (err) {
    console.error("[google/callback]", err);
    return NextResponse.redirect(
      `${base}/cockpit/kalender?google_error=token_exchange`
    );
  }
}
