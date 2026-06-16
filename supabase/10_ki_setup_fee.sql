-- =====================================================================
-- RSG CRM – 10_ki_setup_fee.sql
-- =====================================================================
-- Einmalige Implementierungs-/Installationskosten je KI-Projekt
-- (zusätzlich zum monatlichen Fixpreis / MRR).
-- Idempotent – im Supabase SQL-Editor ausführen.
-- =====================================================================

alter table public.ki_projects
  add column if not exists setup_fee numeric not null default 0;
