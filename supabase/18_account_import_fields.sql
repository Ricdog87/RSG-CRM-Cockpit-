-- =====================================================================
-- RSG CRM – 18_account_import_fields.sql
-- =====================================================================
-- Zusätzliche Account-Felder für den HubSpot-CSV-Import:
--  • owner            = „Für Unternehmen zuständiger Mitarbeiter"
--  • country          = „Land/Region"
--  • external_id      = „Datensatz-ID" (HubSpot) – für Dubletten-Abgleich
--  • last_activity_at = „Datum der letzten Aktivität"
-- („Stadt"→ort, „Telefonnummer"→contact_phone, „Erstellungsdatum"→since
--  existieren bereits.)
-- Idempotent – im Supabase SQL-Editor ausführen.
-- =====================================================================

alter table public.accounts add column if not exists owner            text;
alter table public.accounts add column if not exists country          text;
alter table public.accounts add column if not exists external_id      text;
alter table public.accounts add column if not exists last_activity_at timestamptz;

-- Schneller Dubletten-Abgleich über die HubSpot-ID.
create index if not exists idx_accounts_external_id
  on public.accounts(external_id) where external_id is not null;
