-- =====================================================================
-- RSG CRM – 05_candidate_consents.sql
-- =====================================================================
-- DSGVO-Einwilligungen je Kandidat:in (Anfrage per E-Mail, Erteilen/Widerruf
-- über öffentlichen Token). Erteilen/Widerrufen läuft via Service-Role
-- (bypassed RLS) – daher hier nur SELECT/INSERT-Policies für authenticated.
-- Idempotent – im Supabase SQL-Editor ausführen.
-- =====================================================================

create table if not exists public.candidate_consents (
  id           uuid primary key default gen_random_uuid(),
  partner_id   uuid not null references public.partners(id) on delete cascade,
  candidate_id uuid not null references public.candidates(id) on delete cascade,
  token        text not null unique,
  status       text not null default 'pending',   -- pending | granted | revoked
  text_version text,
  email_to     text,
  sent_at      timestamptz,
  granted_at   timestamptz,
  revoked_at   timestamptz,
  expires_at   timestamptz,
  ip_address   text,
  user_agent   text,
  created_at   timestamptz not null default now()
);
create index if not exists idx_candidate_consents_cand on public.candidate_consents(candidate_id);
create index if not exists idx_candidate_consents_token on public.candidate_consents(token);

alter table public.candidate_consents enable row level security;

drop policy if exists candidate_consents_select on public.candidate_consents;
create policy candidate_consents_select on public.candidate_consents for select
  using (public.fn_is_admin() or partner_id = public.current_partner_id()
         or public.fn_is_descendant(partner_id));

drop policy if exists candidate_consents_insert on public.candidate_consents;
create policy candidate_consents_insert on public.candidate_consents for insert
  with check (partner_id = public.current_partner_id());

grant select, insert on public.candidate_consents to authenticated;
