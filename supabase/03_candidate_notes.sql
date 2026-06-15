-- =====================================================================
-- RSG CRM – 03_candidate_notes.sql
-- =====================================================================
-- Notizen je Kandidat:in (Aktivitäts-Center der Recruiting-Detailmaske).
-- Idempotent – im Supabase SQL-Editor ausführen.
-- =====================================================================

create table if not exists public.candidate_notes (
  id           uuid primary key default gen_random_uuid(),
  partner_id   uuid not null references public.partners(id) on delete cascade,
  candidate_id uuid not null references public.candidates(id) on delete cascade,
  body         text not null,
  created_at   timestamptz not null default now()
);
create index if not exists idx_candidate_notes_cand on public.candidate_notes(candidate_id);

alter table public.candidate_notes enable row level security;

drop policy if exists candidate_notes_select on public.candidate_notes;
create policy candidate_notes_select on public.candidate_notes for select
  using (public.fn_is_admin() or partner_id = public.current_partner_id()
         or public.fn_is_descendant(partner_id));

drop policy if exists candidate_notes_insert on public.candidate_notes;
create policy candidate_notes_insert on public.candidate_notes for insert
  with check (partner_id = public.current_partner_id());

drop policy if exists candidate_notes_delete on public.candidate_notes;
create policy candidate_notes_delete on public.candidate_notes for delete
  using (partner_id = public.current_partner_id() or public.fn_is_admin());

grant select, insert, delete on public.candidate_notes to authenticated;
