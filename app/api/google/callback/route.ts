import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient, hasServiceRole } from "@/lib/supabase/service";
import { exchangeCode, buildRedirectUri } from "@/lib/google-calendar";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/google/callback
 *
 * Google leitet hierher nach der Nutzer-Zustimmung weiter.
 *
 * Sicherheit (CSRF / Token-Injection):
 *   Die Tokens werden AUSSCHLIESSLICH fuer die per Session authentifizierte
 *   Partner-ID gespeichert – niemals fuer eine aus `state` uebernommene ID.
 *   `state` wird zusaetzlich als CSRF-Check gegen die Session-Partner-ID geprueft.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const error = url.searchParams.get("error");
  const base = url.origin;

  // ── Fehler von Google (z.B. Nutzer hat abgebrochen) ────────────────
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

  if (!hasServiceRole()) {
    return NextResponse.redirect(
      `${base}/cockpit/kalender?google_error=not_configured`
    );
  }

  // ── Session ist Pflicht – ohne eingeloggten User kein Token-Schreiben ─
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.redirect(`${base}/cockpit/login`);
  }

  // ── Partner-ID aus der Session ableiten (NICHT aus state) ───────────
  const svc = createServiceClient();
  const { data: partner } = await svc
    .from("partners")
    .select("id")
    .eq("auth_user_id", user.id)
    .single();
  if (!partner) {
    return NextResponse.redirect(
      `${base}/cockpit/kalender?google_error=no_partner`
    );
  }
  const partnerId = (partner as { id: string }).id;

  // ── CSRF-Check: state muss zur Session-Partner-ID passen ────────────
  if (state !== partnerId) {
    return NextResponse.redirect(
      `${base}/cockpit/kalender?google_error=state_mismatch`
    );
  }

  try {
    // ── Code gegen Tokens tauschen ──────────────────────────────────
    const redirectUri = buildRedirectUri(base);
    const tokens = await exchangeCode(code, redirectUri);

    // refresh_token kommt nur mit prompt=consent (so in buildAuthUrl gesetzt).
    if (!tokens.refresh_token) {
      return NextResponse.redirect(
        `${base}/cockpit/kalender?google_error=no_refresh_token`
      );
    }

    const expiresAt = new Date(Date.now() + tokens.expires_in * 1000);

    // ── Tokens speichern (Upsert fuer die Session-Partner-ID) ───────
    const { error: dbErr } = await svc.from("google_calendar_tokens").upsert(
      {
        partner_id: partnerId,
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
