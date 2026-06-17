-- =====================================================================
-- RSG CRM – 17_references_aftercare.sql
-- =====================================================================
-- Referenz-Check je Kandidat:in + Aftercare/NPS je Platzierung.
-- Idempotent – im Supabase SQL-Editor ausführen.
-- =====================================================================

-- ---- Referenzen -----------------------------------------------------
create table if not exists public.candidate_references (
  id           uuid primary key default gen_random_uuid(),
  partner_id   uuid not null references public.partners(id) on delete cascade,
  candidate_id uuid not null references public.candidates(id) on delete cascade,
  referee_name text,
  relationship text,           -- z.B. „ehem. Vorgesetzte:r"
  contact      text,           -- Telefon/E-Mail
  status       text not null default 'angefragt'
                 check (status in ('angefragt','ausstehend','erhalten','abgelehnt')),
  feedback     text,
  created_at   timestamptz not null default now()
);
create index if not exists idx_references_candidate on public.candidate_references(candidate_id);

alter table public.candidate_references enable row level security;
drop policy if exists refs_select on public.candidate_references;
create policy refs_select on public.candidate_references for select
  using (public.fn_is_admin() or partner_id = public.current_partner_id()
         or public.fn_is_descendant(partner_id));
drop policy if exists refs_insert on public.candidate_references;
create policy refs_insert on public.candidate_references for insert
  with check (partner_id = public.current_partner_id());
drop policy if exists refs_update on public.candidate_references;
create policy refs_update on public.candidate_references for update
  using (partner_id = public.current_partner_id() or public.fn_is_admin());
drop policy if exists refs_delete on public.candidate_references;
create policy refs_delete on public.candidate_references for delete
  using (partner_id = public.current_partner_id() or public.fn_is_admin());
grant select, insert, update, delete on public.candidate_references to authenticated;

-- ---- Aftercare / NPS je Platzierung ---------------------------------
alter table public.placements add column if not exists client_nps      int;   -- 0..10
alter table public.placements add column if not exists candidate_nps   int;   -- 0..10
alter table public.placements add column if not exists aftercare_notes text;
