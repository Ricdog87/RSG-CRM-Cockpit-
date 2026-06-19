import "server-only";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient, hasServiceRole } from "@/lib/supabase/service";

// ─── Google OAuth & Calendar API ──────────────────────────────────────────────
const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_CALENDAR_BASE = "https://www.googleapis.com/calendar/v3";
const GOOGLE_SCOPES = [
  "https://www.googleapis.com/auth/calendar.events",
  "https://www.googleapis.com/auth/calendar.readonly",
].join(" ");

const CLIENT_ID = process.env.GOOGLE_CLIENT_ID ?? "";
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET ?? "";

/** true ⇒ Google-ENV sind gesetzt, OAuth-Flow möglich */
export function googleConfigured(): boolean {
  return CLIENT_ID.length > 0 && CLIENT_SECRET.length > 0;
}

/** Konstruiert die Redirect-URI aus dem Request-Origin (kein hartkodierter Host). */
export function buildRedirectUri(origin: string): string {
  return `${origin}/api/google/callback`;
}

/**
 * Baut die Google-OAuth-Consent-URL.
 * state = partnerId (einfacher CSRF-Schutz; kann mit HMAC-Signatur erweitert werden).
 */
export function buildAuthUrl(redirectUri: string, state: string): string {
  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: GOOGLE_SCOPES,
    access_type: "offline",   // Damit Google auch einen refresh_token liefert.
    prompt: "consent",        // Erzwingt neuen refresh_token bei Re-Verbindung.
    state,
  });
  return `${GOOGLE_AUTH_URL}?${params}`;
}

// ─── Token-Typen ──────────────────────────────────────────────────────────────

interface GoogleTokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  token_type: string;
  error?: string;
}

interface StoredToken {
  partner_id: string;
  access_token: string;
  refresh_token: string;
  expires_at: string;
  calendar_id: string;
}

// ─── Token-Austausch (Authorization Code → Tokens) ────────────────────────────

/** Tauscht den Authorization-Code gegen access_token + refresh_token. */
export async function exchangeCode(
  code: string,
  redirectUri: string
): Promise<GoogleTokenResponse> {
  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }),
  });
  const data: GoogleTokenResponse = await res.json();
  if (!res.ok || data.error) {
    throw new Error(`Token exchange failed: ${data.error ?? res.statusText}`);
  }
  return data;
}

/** Erneuert den access_token via refresh_token. */
async function refreshAccessToken(
  refreshToken: string
): Promise<{ access_token: string; expires_at: Date }> {
  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      grant_type: "refresh_token",
    }),
  });
  const data: GoogleTokenResponse = await res.json();
  if (!res.ok || data.error) {
    throw new Error(`Token refresh failed: ${data.error ?? res.statusText}`);
  }
  return {
    access_token: data.access_token,
    expires_at: new Date(Date.now() + data.expires_in * 1000),
  };
}

// ─── Gültiges Access-Token holen (mit Auto-Refresh) ──────────────────────────

/**
 * Gibt ein gültiges access_token + die partnerId zurück.
 * Erneuert automatisch per refresh_token wenn der Access-Token abgelaufen ist.
 * Gibt null zurück wenn:
 *  - kein Service-Role-Key konfiguriert
 *  - kein eingeloggter User
 *  - kein Google-Token gespeichert
 *  - Refresh fehlschlägt (Token wird dann gelöscht → User muss neu verbinden)
 */
export async function getValidAccessToken(): Promise<{
  token: string;
  partnerId: string;
  calendarId: string;
} | null> {
  if (!googleConfigured() || !hasServiceRole()) return null;

  // User-Session via Cookie-basiertem SSR-Client lesen.
  const userClient = createClient();
  const {
    data: { user },
  } = await userClient.auth.getUser();
  if (!user) return null;

  const svc = createServiceClient();

  // Partner-ID des eingeloggten Users.
  const { data: partner } = await svc
    .from("partners")
    .select("id")
    .eq("auth_user_id", user.id)
    .single();
  if (!partner) return null;
  const partnerId = (partner as { id: string }).id;

  // Gespeicherten Token laden.
  const { data: stored } = await svc
    .from("google_calendar_tokens")
    .select("access_token, refresh_token, expires_at, calendar_id")
    .eq("partner_id", partnerId)
    .maybeSingle();
  if (!stored) return null;

  const row = stored as StoredToken;
  const expiresAt = new Date(row.expires_at);
  // 5-Minuten-Puffer: Token erneuern bevor er tatsächlich abläuft.
  const needsRefresh = expiresAt.getTime() - Date.now() < 5 * 60 * 1000;

  if (needsRefresh) {
    try {
      const refreshed = await refreshAccessToken(row.refresh_token);
      await svc
        .from("google_calendar_tokens")
        .update({
          access_token: refreshed.access_token,
          expires_at: refreshed.expires_at.toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("partner_id", partnerId);
      return {
        token: refreshed.access_token,
        partnerId,
        calendarId: row.calendar_id,
      };
    } catch {
      // Refresh fehlgeschlagen → Token ungültig, löschen (User muss neu verbinden).
      await svc
        .from("google_calendar_tokens")
        .delete()
        .eq("partner_id", partnerId);
      return null;
    }
  }

  return { token: row.access_token, partnerId, calendarId: row.calendar_id };
}

// ─── Google Calendar Events ───────────────────────────────────────────────────

export interface GoogleEvent {
  id: string;
  summary: string;
  description?: string;
  start: { dateTime?: string; date?: string };
  end: { dateTime?: string; date?: string };
  htmlLink?: string;
  /** true = kommt von Google (nicht aus CRM) */
  fromGoogle: true;
}

/**
 * Lädt Events aus Google Calendar für einen Zeitraum.
 * Gibt [] zurück wenn der Token ungøltig ist (401) oder ein Netzwerkfehler auftritt.
 */
export async function fetchGoogleEvents(
  accessToken: string,
  calendarId = "primary",
  timeMin?: string,
  timeMax?: string
): Promise<GoogleEvent[]> {
  const params = new URLSearchParams({
    singleEvents: "true",
    orderBy: "startTime",
    maxResults: "500",
  });
  if (timeMin) params.set("timeMin", timeMin);
  if (timeMax) params.set("timeMax", timeMax);

  const res = await fetch(
    `${GOOGLE_CALENDAR_BASE}/calendars/${encodeURIComponent(calendarId)}/events?${params}`,
    {
      headers: { Authorization: `Bearer ${accessToken}` },
      // Nicht cachen – immer frische Daten.
      cache: "no-store",
    }
  );

  if (res.status === 401) return []; // Token abgelaufen/widerrufen.
  if (!res.ok) {
    console.error("[google-calendar] fetchEvents", res.status, await res.text());
    return [];
  }
  const data = await res.json();
  return ((data.items ?? []) as GoogleEvent[]).map((e) => ({
    ...e,
    fromGoogle: true,
  }));
}

// ─── CRM-Task → Google Calendar (Upsert) ─────────────────────────────────────

export interface CrmTaskForSync {
  id: string;
  title: string;
  notes?: string | null;
  related_label?: string | null;
  due_date: string;            // "YYYY-MM-DD"
  due_time?: string | null;    // "HH:MM" oder null
}

/**
 * Legt einen CRM-Task als Google-Calendar-Event an oder aktualisiert ihn.
 * Gibt die neue/vorhandene Google-Event-ID zurück oder null bei Fehler.
 */
export async function upsertGoogleEvent(
  accessToken: string,
  task: CrmTaskForSync,
  existingEventId: string | null = null,
  calendarId = "primary"
): Promise<string | null> {
  const description = [task.related_label, task.notes]
    .filter(Boolean)
    .join(" — ");

  // Timed-Event (1 h Dauer) vs. Ganztages-Event.
  let start: object;
  let end: object;
  if (task.due_time) {
    const [hh, mm] = task.due_time.split(":").map(Number);
    const startDt = new Date(`${task.due_date}T${task.due_time}:00`);
    const endDt = new Date(startDt.getTime() + 60 * 60 * 1000);
    // ISO ohne Millisekunden, z.B. "2026-06-17T10:00:00"
    const fmt = (d: Date) =>
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}T${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}:00`;
    start = { dateTime: fmt(startDt), timeZone: "Europe/Berlin" };
    end = { dateTime: fmt(endDt), timeZone: "Europe/Berlin" };
    void hh; void mm; // suppress unused var warning
  } else {
    start = { date: task.due_date };
    end = { date: task.due_date };
  }

  const body: Record<string, unknown> = {
    summary: task.title,
    start,
    end,
    source: {
      title: "RSG CRM",
      url: `${process.env.NEXT_PUBLIC_APP_URL ?? "https://rsg-crm-cockpit.vercel.app"}/cockpit/kalender`,
    },
  };
  if (description) body.description = description;

  const url = existingEventId
    ? `${GOOGLE_CALENDAR_BASE}/calendars/${encodeURIComponent(calendarId)}/events/${existingEventId}`
    : `${GOOGLE_CALENDAR_BASE}/calendars/${encodeURIComponent(calendarId)}/events`;
  const method = existingEventId ? "PUT" : "POST";

  const res = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    console.error("[google-calendar] upsertEvent", res.status, await res.text());
    return null;
  }
  const data = await res.json();
  return (data.id as string) ?? null;
}

/**
 * Löscht einen Google-Calendar-Event (z.B. wenn ein CRM-Task gelöscht wird).
 * Fehler werden still geschluckt (Event kann bereits gelöscht sein).
 */
export async function deleteGoogleEvent(
  accessToken: string,
  eventId: string,
  calendarId = "primary"
): Promise<void> {
  await fetch(
    `${GOOGLE_CALENDAR_BASE}/calendars/${encodeURIComponent(calendarId)}/events/${eventId}`,
    {
      method: "DELETE",
      headers: { Authorization: `Bearer ${accessToken}` },
    }
  ).catch(() => {}); // silent
}
