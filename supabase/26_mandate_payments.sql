-- 26_mandate_payments.sql
-- Zahlungs-Gate für Festpreis-Mandate: Anzahlung bezahlt → Suche starten,
-- Restzahlung bei Besetzung der Stelle. Additiv & idempotent.

alter table public.recruiting_mandates
  add column if not exists deposit_paid    boolean not null default false,
  add column if not exists deposit_paid_at date,
  add column if not exists final_paid      boolean not null default false,
  add column if not exists final_paid_at   date;

comment on column public.recruiting_mandates.deposit_paid is
  'Festpreis: Anzahlung bezahlt → Suche/Sourcing kann starten.';
comment on column public.recruiting_mandates.final_paid is
  'Festpreis: Restzahlung (bei Besetzung der Stelle) bezahlt.';
