-- =====================================================================
-- RSG CRM – 29_fonio_calls.sql
-- =====================================================================
-- Protokoll der KI-Outbound-Anrufe (Fonio) je Kandidat:in. Ohne diese Tabelle
-- ging die Anruf-Historie verloren (Insert schlug still fehl).
-- Idempotent – im Supabase SQL-Editor ausführen.
-- =====================================================================

create table if not exists public.fonio_calls (
  id           uuid primary key default gen_random_uuid(),
  partner_id   uuid not null references public.partners(id) on delete cascade,
  candidate_id uuid references public.candidates(id) on delete set null,
  to_number    text,
  from_number  text,
  status       text,
  fonio_status text,
  message      text,
  created_at   timestamptz not null default now()
);
create index if not exists idx_fonio_calls_candidate
  on public.fonio_calls(candidate_id, created_at desc);
create index if not exists idx_fonio_calls_partner
  on public.fonio_calls(partner_id, created_at desc);

alter table public.fonio_calls enable row level security;
drop policy if exists fonio_calls_select on public.fonio_calls;
create policy fonio_calls_select on public.fonio_calls for select
  using (public.fn_is_admin() or partner_id = public.current_partner_id()
         or public.fn_is_descendant(partner_id));
drop policy if exists fonio_calls_insert on public.fonio_calls;
create policy fonio_calls_insert on public.fonio_calls for insert
  with check (partner_id = public.current_partner_id());
drop policy if exists fonio_calls_delete on public.fonio_calls;
create policy fonio_calls_delete on public.fonio_calls for delete
  using (partner_id = public.current_partner_id() or public.fn_is_admin());
grant select, insert, delete on public.fonio_calls to authenticated;
