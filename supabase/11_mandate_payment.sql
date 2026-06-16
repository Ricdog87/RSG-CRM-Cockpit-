-- =====================================================================
-- RSG CRM – 11_mandate_payment.sql
-- =====================================================================
-- Zahlungsmodalitäten je Recruiting-Mandat:
--   • deposit       = Anzahlung je Stelle (fix bei Auftrag), Rest bei Vermittlung
--   • split_payment = Erfolgshonorar 50/50 (Unterzeichnung / nach 3 Monaten)
-- Idempotent – im Supabase SQL-Editor ausführen.
-- =====================================================================

alter table public.recruiting_mandates
  add column if not exists deposit numeric not null default 0;
alter table public.recruiting_mandates
  add column if not exists split_payment boolean not null default false;
