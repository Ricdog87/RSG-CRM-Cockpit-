-- =====================================================================
-- RSG CRM – 12_mandate_job_posting.sql
-- =====================================================================
-- Original-Stellenausschreibung je Mandat + anonymisierte Fassung +
-- öffentlicher Teilen-Token. Idempotent – im Supabase SQL-Editor ausführen.
-- =====================================================================

alter table public.recruiting_mandates
  add column if not exists job_posting            text;
alter table public.recruiting_mandates
  add column if not exists job_posting_anonymized text;
alter table public.recruiting_mandates
  add column if not exists share_token            text;

-- Schneller Lookup der öffentlichen Stellen-Seite (/stelle/<token>).
create unique index if not exists idx_mandate_share_token
  on public.recruiting_mandates(share_token)
  where share_token is not null;
