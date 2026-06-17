-- =====================================================================
-- RSG CRM – 25_activity_log.sql
-- =====================================================================
-- Aktivitäts-Log für Tagesziele & Wochenfokus: Calls/E-Mails mit
-- Geschäftslinie (KI/Recruiting), optionalem Kundenbezug & Thema.
-- Idempotent – im Supabase SQL-Editor ausführen.
-- =====================================================================

create table if not exists public.activity_log (
  id           uuid primary key default gen_random_uuid(),
  partner_id   uuid not null references public.partners(id) on delete cascade,
  kind         text not null check (kind in ('call','email','meeting')),
  line         text not null check (line in ('ki','recruiting')),
  subject      text,
  account_name text,
  candidate_id uuid references public.candidates(id) on delete set null,
  created_at   timestamptz not null default now()
);
create index if not exists idx_activity_log_partner_created
  on public.activity_log(partner_id, created_at desc);

alter table public.activity_log enable row level security;
drop policy if exists activity_select on public.activity_log;
create policy activity_select on public.activity_log for select
  using (public.fn_is_admin() or partner_id = public.current_partner_id()
         or public.fn_is_descendant(partner_id));
drop policy if exists activity_insert on public.activity_log;
create policy activity_insert on public.activity_log for insert
  with check (partner_id = public.current_partner_id());
drop policy if exists activity_delete on public.activity_log;
create policy activity_delete on public.activity_log for delete
  using (partner_id = public.current_partner_id() or public.fn_is_admin());
grant select, insert, delete on public.activity_log to authenticated;
