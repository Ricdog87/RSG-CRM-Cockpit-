-- =====================================================================
-- RSG CRM – 20_ki_milestones.sql
-- =====================================================================
-- Projektplan (Meilensteine) + Go-Live-Readiness-Checkliste je KI-Projekt.
-- Idempotent – im Supabase SQL-Editor ausführen.
-- =====================================================================

-- ---- Meilensteine ---------------------------------------------------
create table if not exists public.ki_milestones (
  id         uuid primary key default gen_random_uuid(),
  partner_id uuid not null references public.partners(id) on delete cascade,
  project_id uuid not null references public.ki_projects(id) on delete cascade,
  title      text not null,
  sort_order int not null default 0,
  status     text not null default 'offen'
               check (status in ('offen','in_arbeit','erledigt')),
  target_date date,
  done_date   date,
  notes      text,
  created_at timestamptz not null default now()
);
create index if not exists idx_ki_milestones_project on public.ki_milestones(project_id);

alter table public.ki_milestones enable row level security;
drop policy if exists ki_ms_select on public.ki_milestones;
create policy ki_ms_select on public.ki_milestones for select
  using (public.fn_is_admin() or partner_id = public.current_partner_id()
         or public.fn_is_descendant(partner_id));
drop policy if exists ki_ms_insert on public.ki_milestones;
create policy ki_ms_insert on public.ki_milestones for insert
  with check (partner_id = public.current_partner_id());
drop policy if exists ki_ms_update on public.ki_milestones;
create policy ki_ms_update on public.ki_milestones for update
  using (partner_id = public.current_partner_id() or public.fn_is_admin());
drop policy if exists ki_ms_delete on public.ki_milestones;
create policy ki_ms_delete on public.ki_milestones for delete
  using (partner_id = public.current_partner_id() or public.fn_is_admin());
grant select, insert, update, delete on public.ki_milestones to authenticated;

-- ---- Go-Live-Readiness ----------------------------------------------
create table if not exists public.ki_readiness (
  id         uuid primary key default gen_random_uuid(),
  partner_id uuid not null references public.partners(id) on delete cascade,
  project_id uuid not null references public.ki_projects(id) on delete cascade,
  item_key   text not null,
  checked    boolean not null default false,
  updated_at timestamptz not null default now(),
  unique (project_id, item_key)
);
create index if not exists idx_ki_readiness_project on public.ki_readiness(project_id);

alter table public.ki_readiness enable row level security;
drop policy if exists ki_rd_select on public.ki_readiness;
create policy ki_rd_select on public.ki_readiness for select
  using (public.fn_is_admin() or partner_id = public.current_partner_id()
         or public.fn_is_descendant(partner_id));
drop policy if exists ki_rd_insert on public.ki_readiness;
create policy ki_rd_insert on public.ki_readiness for insert
  with check (partner_id = public.current_partner_id());
drop policy if exists ki_rd_update on public.ki_readiness;
create policy ki_rd_update on public.ki_readiness for update
  using (partner_id = public.current_partner_id() or public.fn_is_admin());
drop policy if exists ki_rd_delete on public.ki_readiness;
create policy ki_rd_delete on public.ki_readiness for delete
  using (partner_id = public.current_partner_id() or public.fn_is_admin());
grant select, insert, update, delete on public.ki_readiness to authenticated;
