-- =====================================================================
-- RSG CRM – 16_account_contract.sql
-- =====================================================================
-- Vermittlungsvertrag / Honorarvereinbarung je Kunde (Account).
-- Idempotent – im Supabase SQL-Editor ausführen.
-- =====================================================================

alter table public.accounts add column if not exists engagement_type   text;   -- exklusiv | nicht_exklusiv | retainer
alter table public.accounts add column if not exists contract_status   text not null default 'kein'; -- kein | versendet | unterzeichnet
alter table public.accounts add column if not exists contract_signed_at date;
alter table public.accounts add column if not exists fee_agreement     text;
