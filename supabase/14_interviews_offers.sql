-- =====================================================================
-- RSG CRM – 14_interviews_offers.sql
-- =====================================================================
-- Strukturierte Interviews (Termin, Art, Interviewer, Scorecard/Feedback)
-- und Angebote (Gehalt, Eintritt, Status, Ablehnungsgrund) je Kandidat:in.
-- Ablehnungsgründe liefern dem Matching-Algorithmus Lernsignal.
-- Idempotent – im Supabase SQL-Editor ausführen.
-- =====================================================================

-- ---- Interviews -----------------------------------------------------
create table if not exists public.candidate_interviews (
  id           uuid primary key default gen_random_uuid(),
  partner_id   uuid not null references public.partners(id) on delete cascade,
  candidate_id uuid not null references public.candidates(id) on delete cascade,
  mandate_id   uuid references public.recruiting_mandates(id) on delete set null,
  scheduled_at timestamptz,
  type         text not null default 'telefon'
                 check (type in ('telefon','video','vor_ort','kundengespraech')),
  interviewer  text,
  location     text,
  status       text not null default 'geplant'
                 check (status in ('geplant','stattgefunden','abgesagt','verschoben')),
  score        int,           -- 1..5 Scorecard
  feedback     text,
  created_at   timestamptz not null default now()
);
create index if not exists idx_interviews_candidate on public.candidate_interviews(candidate_id);
create index if not exists idx_interviews_mandate on public.candidate_interviews(mandate_id);

alter table public.candidate_interviews enable row level security;
drop policy if exists interviews_select on public.candidate_interviews;
create policy interviews_select on public.candidate_interviews for select
  using (public.fn_is_admin() or partner_id = public.current_partner_id()
         or public.fn_is_descendant(partner_id));
drop policy if exists interviews_insert on public.candidate_interviews;
create policy interviews_insert on public.candidate_interviews for insert
  with check (partner_id = public.current_partner_id());
drop policy if exists interviews_update on public.candidate_interviews;
create policy interviews_update on public.candidate_interviews for update
  using (partner_id = public.current_partner_id() or public.fn_is_admin());
drop policy if exists interviews_delete on public.candidate_interviews;
create policy interviews_delete on public.candidate_interviews for delete
  using (partner_id = public.current_partner_id() or public.fn_is_admin());
grant select, insert, update, delete on public.candidate_interviews to authenticated;

-- ---- Angebote -------------------------------------------------------
create table if not exists public.candidate_offers (
  id             uuid primary key default gen_random_uuid(),
  partner_id     uuid not null references public.partners(id) on delete cascade,
  candidate_id   uuid not null references public.candidates(id) on delete cascade,
  mandate_id     uuid references public.recruiting_mandates(id) on delete set null,
  offered_salary numeric,
  start_date     date,
  offer_date     date,
  status         text not null default 'entwurf'
                   check (status in ('entwurf','versendet','in_verhandlung','angenommen','abgelehnt')),
  decline_reason text,
  notes          text,
  created_at     timestamptz not null default now()
);
create index if not exists idx_offers_candidate on public.candidate_offers(candidate_id);
create index if not exists idx_offers_mandate on public.candidate_offers(mandate_id);

alter table public.candidate_offers enable row level security;
drop policy if exists offers_select on public.candidate_offers;
create policy offers_select on public.candidate_offers for select
  using (public.fn_is_admin() or partner_id = public.current_partner_id()
         or public.fn_is_descendant(partner_id));
drop policy if exists offers_insert on public.candidate_offers;
create policy offers_insert on public.candidate_offers for insert
  with check (partner_id = public.current_partner_id());
drop policy if exists offers_update on public.candidate_offers;
create policy offers_update on public.candidate_offers for update
  using (partner_id = public.current_partner_id() or public.fn_is_admin());
drop policy if exists offers_delete on public.candidate_offers;
create policy offers_delete on public.candidate_offers for delete
  using (partner_id = public.current_partner_id() or public.fn_is_admin());
grant select, insert, update, delete on public.candidate_offers to authenticated;
