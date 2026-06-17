-- =====================================================================
-- RSG CRM – 22_ki_contract_renewal.sql
-- =====================================================================
-- Vertrag, Verlängerung, Churn-Risiko & Upsell je KI-Projekt.
-- Idempotent – im Supabase SQL-Editor ausführen.
-- =====================================================================

alter table public.ki_projects add column if not exists contract_start    date;
alter table public.ki_projects add column if not exists contract_end      date;     -- Verlängerungsdatum
alter table public.ki_projects add column if not exists term_months       int;      -- Laufzeit
alter table public.ki_projects add column if not exists billing_cycle     text;     -- monatlich | quartal | jaehrlich
alter table public.ki_projects add column if not exists auto_renew        boolean not null default false;
alter table public.ki_projects add column if not exists churn_risk        text;     -- niedrig | mittel | hoch
alter table public.ki_projects add column if not exists nps               int;      -- Kunden-NPS (0–10)
alter table public.ki_projects add column if not exists upsell_potential  text;     -- Notiz
alter table public.ki_projects add column if not exists upsell_value      numeric;  -- potenzieller Mehrumsatz (€/Mo)
