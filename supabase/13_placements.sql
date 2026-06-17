-- =====================================================================
-- RSG CRM – 13_placements.sql
-- =====================================================================
-- Platzierungen (erfolgreiche Vermittlungen) mit Eintrittsdatum,
-- Probezeit/Garantie und Status – Grundlage für Honorar-Fälligkeit
-- (50 % nach 3 Monaten) und Ausfall-/Nachbesetzungsgarantie.
-- Idempotent – im Supabase SQL-Editor ausführen.
-- =====================================================================

create table if not exists public.placements (
  id               uuid primary key default gen_random_uuid(),
  partner_id       uuid not null references public.partners(id) on delete cascade,
  candidate_id     uuid references public.candidates(id) on delete set null,
  mandate_id       uuid references public.recruiting_mandates(id) on delete set null,
  candidate_name   text,
  account_name     text,
  role             text,
  start_date       date,            -- Eintrittsdatum
  agreed_fee       numeric,         -- vereinbartes Gesamthonorar (€)
  guarantee_months int not null default 6,   -- Probezeit-/Garantiedauer
  status           text not null default 'aktiv'
                     check (status in ('aktiv','garantie_ok','ausgefallen','nachbesetzung')),
  notes            text,
  created_at       timestamptz not null default now()
);

create index if not exists idx_placements_mandate on public.placements(mandate_id);
create index if not exists idx_placements_candidate on public.placements(candidate_id);
create index if not exists idx_placements_start on public.placements(start_date);

alter table public.placements enable row level security;

drop policy if exists placements_select on public.placements;
create policy placements_select on public.placements for select
  using (public.fn_is_admin() or partner_id = public.current_partner_id()
         or public.fn_is_descendant(partner_id));

drop policy if exists placements_insert on public.placements;
create policy placements_insert on public.placements for insert
  with check (partner_id = public.current_partner_id());

drop policy if exists placements_update on public.placements;
create policy placements_update on public.placements for update
  using (partner_id = public.current_partner_id() or public.fn_is_admin());

drop policy if exists placements_delete on public.placements;
create policy placements_delete on public.placements for delete
  using (partner_id = public.current_partner_id() or public.fn_is_admin());

grant select, insert, update, delete on public.placements to authenticated;
