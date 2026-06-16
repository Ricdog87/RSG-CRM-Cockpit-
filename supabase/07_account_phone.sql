-- =====================================================================
-- RSG CRM – 07_account_phone.sql
-- =====================================================================
-- Telefonnummer am Account (für tägliche Kundenanrufe).
-- Idempotent – im Supabase SQL-Editor ausführen.
-- =====================================================================

alter table public.accounts add column if not exists contact_phone text;
