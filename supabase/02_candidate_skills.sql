-- =====================================================================
-- RSG CRM – 02_candidate_skills.sql
-- =====================================================================
-- Ergänzt die Kandidaten-Tabelle um ein Skill-Set (aus dem CV extrahierbar).
-- Idempotent – im Supabase SQL-Editor ausführen.
-- =====================================================================

alter table public.candidates
  add column if not exists skills text[];
