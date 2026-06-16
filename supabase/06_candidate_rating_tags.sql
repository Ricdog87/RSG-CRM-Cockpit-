-- =====================================================================
-- RSG CRM – 06_candidate_rating_tags.sql
-- =====================================================================
-- Bewertung (0–5 Sterne) und freie Tags je Kandidat:in für schnelles
-- Filtern/Priorisieren. Idempotent – im Supabase SQL-Editor ausführen.
-- =====================================================================

alter table public.candidates add column if not exists rating int;
alter table public.candidates add column if not exists tags   text[];
