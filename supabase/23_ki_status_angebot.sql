-- =====================================================================
-- RSG CRM – 23_ki_status_angebot.sql
-- =====================================================================
-- Neuer KI-Projekt-Status „angebot" (Planung/Angebot) für die Forecast-Sicht
-- – vorgelagert vor Onboarding. Idempotent.
-- =====================================================================

alter table public.ki_projects drop constraint if exists ki_projects_status_check;
alter table public.ki_projects
  add constraint ki_projects_status_check
  check (status in ('angebot','onboarding','live','optimierung','pausiert','gekuendigt'));
