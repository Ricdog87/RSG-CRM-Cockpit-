-- =====================================================================
-- RSG CRM – 27_persistence_fix.sql
-- =====================================================================
-- Behebt „Daten verschwinden nach dem Speichern": ergänzt alle Spalten, die
-- die App schreibt, die aber in der DB fehlten. Ohne diese Spalten hat die
-- graceful-Speicherlogik die Felder still verworfen (gespeichert, aber weg).
-- Additiv & idempotent – im Supabase SQL-Editor ausführen.
-- =====================================================================

-- Accounts: vollständige Postanschrift (Straße + PLZ)
alter table public.accounts add column if not exists strasse text;
alter table public.accounts add column if not exists plz     text;

-- Kandidaten: Recruiter-Stammdaten
alter table public.candidates add column if not exists birth_date       date;
alter table public.candidates add column if not exists current_employer text;
alter table public.candidates add column if not exists languages        text;
alter table public.candidates add column if not exists experience_years integer;
