-- =====================================================================
-- RSG CRM – 30_candidate_db_pivot.sql
-- =====================================================================
-- Pivot: RSG CRM wird reine KANDIDATEN-Datenbank (Datenschutz-Fokus) +
-- Search-&-Match gegen HubSpot-Recruiting-Projekte. Kunden/Deals/Projekte
-- bleiben Source-of-Truth in HubSpot; hier nur read-only Referenz.
--
-- STRIKT ADDITIV: keine DROP/RENAME, keine Datenlöschung. Idempotent
-- (mehrfach ausführbar). Im Supabase SQL-Editor / via Migration ausführen.
-- =====================================================================

begin;

-- ---------------------------------------------------------------------
-- 1) candidates additiv erweitern (kein Rename bestehender Spalten)
--    Mapping vorhandener Felder: salary_expectation = Gehaltsvorstellung,
--    skills/tags vorhanden, availability (Text) bleibt neben verfuegbar_ab.
-- ---------------------------------------------------------------------
alter table public.candidates add column if not exists linkedin_url      text;
alter table public.candidates add column if not exists seniority         text;
alter table public.candidates add column if not exists verfuegbar_ab     date;
alter table public.candidates add column if not exists wechselmotivation text;

-- Verfügbarkeits-/Lifecycle-Status, getrennt vom bestehenden Pipeline-`stage`.
alter table public.candidates add column if not exists availability_status text
  not null default 'NEU';
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'candidates_availability_status_chk') then
    alter table public.candidates add constraint candidates_availability_status_chk
      check (availability_status in
        ('NEU','AKTIV_VERFUEGBAR','IN_VERMITTLUNG','PLATZIERT','INAKTIV','GESPERRT'));
  end if;
end $$;

-- ---------------------------------------------------------------------
-- 2) candidate_consents additiv erweitern (DSGVO, append-only)
--    Bestehende Spalten (status pending|granted|revoked, granted_at, …)
--    bleiben. NEU: Zweck, Rechtsgrundlage, Nachweis + Append-only-Kette.
--    Append-only wird in der Business-Logik erzwungen: jeder Statuswechsel
--    legt einen NEUEN Record an und verweist via supersedes_id auf den
--    vorigen – bestehende Records werden NIE überschrieben (Audit-Trail).
-- ---------------------------------------------------------------------
alter table public.candidate_consents add column if not exists zweck text;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'candidate_consents_zweck_chk') then
    alter table public.candidate_consents add constraint candidate_consents_zweck_chk
      check (zweck is null or zweck in
        ('PROFIL_SPEICHERN','VERMITTLUNG','WEITERGABE_AN_KUNDE'));
  end if;
end $$;
alter table public.candidate_consents add column if not exists rechtsgrundlage text;
alter table public.candidate_consents add column if not exists nachweis        text;
alter table public.candidate_consents add column if not exists supersedes_id   uuid
  references public.candidate_consents(id);
comment on column public.candidate_consents.supersedes_id is
  'Append-only Audit-Trail: verweist auf den vorigen Consent-Record desselben Zwecks. Records werden NIE überschrieben.';

-- ---------------------------------------------------------------------
-- 3) project_refs – READ-ONLY Spiegel der HubSpot-Recruiting-Deals
--    Source of Truth = HubSpot. Nur durch Sync befüllt (upsert per
--    hubspot_deal_id), nie manuelle Projektpflege.
-- ---------------------------------------------------------------------
create table if not exists public.project_refs (
  id               uuid primary key default gen_random_uuid(),
  partner_id       uuid not null references public.partners(id) on delete cascade,
  hubspot_deal_id  text not null,
  titel            text,
  kunde            text,                 -- nur Anzeige (Name); Wahrheit in HubSpot
  anforderungen    text,
  skills           text[] not null default '{}',
  standort         text,
  status           text,                 -- aus HubSpot gespiegelt
  hubspot_pipeline text,
  hubspot_stage    text,
  raw              jsonb,                 -- Roh-Payload zur Nachvollziehbarkeit
  last_synced_at   timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  unique (partner_id, hubspot_deal_id)
);
comment on table public.project_refs is
  'READ-ONLY Spiegel von HubSpot-Recruiting-Deals. Source of Truth = HubSpot. Nur via Sync (upsert per hubspot_deal_id), keine manuelle Projektpflege.';
create index if not exists idx_project_refs_partner on public.project_refs(partner_id);
create index if not exists idx_project_refs_deal    on public.project_refs(hubspot_deal_id);

-- ---------------------------------------------------------------------
-- 4) matches – Kandidat ↔ project_ref (HubSpot-Projekt). Herzstück.
--    Vorstellung nur mit gültigem Consent (VERMITTLUNG/WEITERGABE_AN_KUNDE)
--    – erzwungen in der Business-Logik (Consent-Gate), nicht nur UI.
-- ---------------------------------------------------------------------
create table if not exists public.matches (
  id             uuid primary key default gen_random_uuid(),
  partner_id     uuid not null references public.partners(id) on delete cascade,
  candidate_id   uuid not null references public.candidates(id) on delete cascade,
  project_ref_id uuid not null references public.project_refs(id) on delete cascade,
  score          numeric,
  match_gruende  jsonb,
  status         text not null default 'VORGESCHLAGEN',
  vorgestellt_am timestamptz,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  unique (partner_id, candidate_id, project_ref_id)
);
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'matches_status_chk') then
    alter table public.matches add constraint matches_status_chk
      check (status in ('VORGESCHLAGEN','GEPRUEFT','VORGESTELLT','ABGELEHNT','PLATZIERT'));
  end if;
end $$;
comment on table public.matches is
  'Kandidat ↔ HubSpot-Projekt (project_refs). Vorstellung/Weitergabe nur mit gültigem Consent – erzwungen im Consent-Gate der Business-Logik.';
create index if not exists idx_matches_partner   on public.matches(partner_id);
create index if not exists idx_matches_candidate on public.matches(candidate_id);
create index if not exists idx_matches_project   on public.matches(project_ref_id);

-- ---------------------------------------------------------------------
-- 5) RLS – gleiches Muster wie bestehende Tabellen (partner-scoped)
-- ---------------------------------------------------------------------
alter table public.project_refs enable row level security;
drop policy if exists project_refs_select on public.project_refs;
create policy project_refs_select on public.project_refs for select
  using (public.fn_is_admin() or partner_id = public.current_partner_id()
         or public.fn_is_descendant(partner_id));
drop policy if exists project_refs_cud on public.project_refs;
create policy project_refs_cud on public.project_refs for all
  using (partner_id = public.current_partner_id() or public.fn_is_admin())
  with check (partner_id = public.current_partner_id() or public.fn_is_admin());
grant select, insert, update, delete on public.project_refs to authenticated;

alter table public.matches enable row level security;
drop policy if exists matches_select on public.matches;
create policy matches_select on public.matches for select
  using (public.fn_is_admin() or partner_id = public.current_partner_id()
         or public.fn_is_descendant(partner_id));
drop policy if exists matches_cud on public.matches;
create policy matches_cud on public.matches for all
  using (partner_id = public.current_partner_id() or public.fn_is_admin())
  with check (partner_id = public.current_partner_id() or public.fn_is_admin());
grant select, insert, update, delete on public.matches to authenticated;

commit;

-- =====================================================================
-- ROLLBACK-Hinweis (manuell, nur falls nötig – löscht NUR die NEUEN Objekte):
--   drop table if exists public.matches;
--   drop table if exists public.project_refs;
--   alter table public.candidates drop column if exists availability_status, …;
--   alter table public.candidate_consents drop column if exists zweck, …;
-- (Bestehende Daten/Spalten bleiben davon unberührt.)
-- =====================================================================
