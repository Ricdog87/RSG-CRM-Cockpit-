-- =====================================================================
-- RSG CRM – 04_candidate_note_kind.sql
-- =====================================================================
-- Macht aus candidate_notes ein Aktivitätsprotokoll: Notiz | Anruf | Meeting.
-- Idempotent – im Supabase SQL-Editor ausführen.
-- =====================================================================

alter table public.candidate_notes
  add column if not exists kind text not null default 'note';
