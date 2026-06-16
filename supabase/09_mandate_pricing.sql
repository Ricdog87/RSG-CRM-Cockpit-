-- =====================================================================
-- RSG CRM – 09_mandate_pricing.sql
-- =====================================================================
-- Preismodell je Recruiting-Mandat: Festpreis ODER prozentual vom
-- Zielgehalt. Idempotent – im Supabase SQL-Editor ausführen.
-- =====================================================================

alter table public.recruiting_mandates
  add column if not exists pricing_model text not null default 'fixed';

-- Bestehende/zukünftige Werte absichern (nur 'fixed' | 'percent').
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'recruiting_mandates_pricing_model_chk'
  ) then
    alter table public.recruiting_mandates
      add constraint recruiting_mandates_pricing_model_chk
      check (pricing_model in ('fixed','percent'));
  end if;
end $$;

alter table public.recruiting_mandates
  add column if not exists target_salary numeric;
alter table public.recruiting_mandates
  add column if not exists fee_percent   numeric;
