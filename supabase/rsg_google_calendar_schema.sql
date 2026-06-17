-- =====================================================================
-- RSG CRM – Google Calendar OAuth-Token-Speicher
-- =====================================================================
-- Additive Migration. Nach rsg_calendar_schema.sql ausführen.
--
-- Zweck: Speichert access_token + refresh_token je Partner:in, damit
-- der Server CRM-Tasks automatisch nach Google Calendar synct und
-- Google-Events im Kalender anzeigt (2-Wege-Sync).
--
-- Sicherheit:
--   • Tokens werden AUSSCHLIESSLICH über Service-Role-Client geschrieben
--     (API-Routes /api/google/callback, /api/google/disconnect).
--   • Lesen via ANON + Session (RLS: nur eigene Tokens sichtbar).
--   • Niemals Tokens als NEXT_PUBLIC oder in Client-Code exponieren.
-- =====================================================================

create table if not exists public.google_calendar_tokens (
  id            uuid primary key default gen_random_uuid(),
  partner_id    uuid not null references public.partners(id) on delete cascade,
  access_token  text not null,
  refresh_token text not null,
  expires_at    timestamptz not null,
  -- Welcher Google-Kalender wird für Sync verwendet (default: "primary")
  calendar_id   text not null default 'primary',
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- Jede:r Partner:in hat maximal EINEN verbundenen Google-Kalender.
create unique index if not exists google_calendar_tokens_partner_idx
  on public.google_calendar_tokens (partner_id);

create index if not exists google_calendar_tokens_expires_idx
  on public.google_calendar_tokens (expires_at);

alter table public.google_calendar_tokens enable row level security;

-- Partner:in darf nur eigene Tokens LESEN (kein direktes Schreiben über ANON).
drop policy if exists google_calendar_tokens_select on public.google_calendar_tokens;
create policy google_calendar_tokens_select on public.google_calendar_tokens
  for select using (
    fn_is_admin() or partner_id = current_partner_id()
  );

-- Schreiben NUR über Service-Role (API-Routes), die RLS umgehen.
-- Kein GRANT für insert/update/delete auf authenticated nötig.
grant select on public.google_calendar_tokens to authenticated;

-- =====================================================================
-- SETUP-HINWEIS (Google Cloud Console):
-- 1. Neues Projekt → APIs & Dienste → Google Calendar API aktivieren
-- 2. OAuth 2.0-Client-ID anlegen (Webanwendung)
-- 3. Autorisierte Weiterleitungs-URIs:
--      https://<deine-app>.vercel.app/api/google/callback
--      http://localhost:3000/api/google/callback  (lokal)
-- 4. ENV-Variablen in Vercel (NICHT als NEXT_PUBLIC):
--      GOOGLE_CLIENT_ID=<client_id>
--      GOOGLE_CLIENT_SECRET=<client_secret>
-- =====================================================================
