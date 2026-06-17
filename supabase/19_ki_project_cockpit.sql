-- =====================================================================
-- RSG CRM – 19_ki_project_cockpit.sql
-- =====================================================================
-- Erweiterte Stammdaten für KI-Projekte (Projekt-Cockpit):
-- Use-Case, internes Projektmanagement, Kickoff, Stakeholder.
-- Idempotent – im Supabase SQL-Editor ausführen.
-- =====================================================================

alter table public.ki_projects add column if not exists use_case        text;
alter table public.ki_projects add column if not exists project_manager text;   -- intern verantwortlich
alter table public.ki_projects add column if not exists kickoff_date    date;
alter table public.ki_projects add column if not exists decision_maker  text;   -- Entscheider beim Kunden
alter table public.ki_projects add column if not exists tech_contact    text;   -- technischer Ansprechpartner
