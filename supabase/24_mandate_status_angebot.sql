-- =====================================================================
-- RSG CRM – 24_mandate_status_angebot.sql
-- =====================================================================
-- Forecast-Status „Angebot / Planung" für Recruiting-Mandate.
-- Idempotent – im Supabase SQL-Editor ausführen.
-- =====================================================================

alter table public.recruiting_mandates drop constraint if exists recruiting_mandates_status_check;
alter table public.recruiting_mandates
  add constraint recruiting_mandates_status_check
  check (status in ('angebot','offen','in_arbeit','interviews','besetzt','pausiert'));
