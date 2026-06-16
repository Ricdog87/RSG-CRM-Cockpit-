-- =====================================================================
-- RSG CRM – 08_candidate_matching.sql
-- =====================================================================
-- Matching-Felder am Kandidaten + Vorstellungs-Historie (gegen Doppel-
-- bewerbungen). Idempotent – im Supabase SQL-Editor ausführen.
-- =====================================================================

alter table public.candidates add column if not exists location            text;
alter table public.candidates add column if not exists zip                 text;
alter table public.candidates add column if not exists willing_to_relocate boolean;
alter table public.candidates add column if not exists travel_willingness  text;
alter table public.candidates add column if not exists salary_expectation  numeric;
alter table public.candidates add column if not exists availability        text;

-- Vorstellungs-Historie: welche:r Kandidat:in wurde wann bei welchem Mandat
-- vorgestellt (Champions-League-Match → „Vorstellen").
create table if not exists public.candidate_submissions (
  id           uuid primary key default gen_random_uuid(),
  partner_id   uuid not null references public.partners(id) on delete cascade,
  candidate_id uuid not null references public.candidates(id) on delete cascade,
  mandate_id   uuid references public.recruiting_mandates(id) on delete set null,
  account_name text,
  role         text,
  stage        text not null default 'vorgestellt',
  created_at   timestamptz not null default now()
);
create index if not exists idx_cand_sub_cand on public.candidate_submissions(candidate_id);
create index if not exists idx_cand_sub_mandate on public.candidate_submissions(mandate_id);

alter table public.candidate_submissions enable row level security;

drop policy if exists cand_sub_select on public.candidate_submissions;
create policy cand_sub_select on public.candidate_submissions for select
  using (public.fn_is_admin() or partner_id = public.current_partner_id()
         or public.fn_is_descendant(partner_id));

drop policy if exists cand_sub_insert on public.candidate_submissions;
create policy cand_sub_insert on public.candidate_submissions for insert
  with check (partner_id = public.current_partner_id());

drop policy if exists cand_sub_delete on public.candidate_submissions;
create policy cand_sub_delete on public.candidate_submissions for delete
  using (partner_id = public.current_partner_id() or public.fn_is_admin());

grant select, insert, delete on public.candidate_submissions to authenticated;
