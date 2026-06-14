-- =====================================================================
-- RSG CRM – Aufgaben je Account
-- =====================================================================
-- Additive Migration. Nach rsg_crm_schema.sql ausführen.
-- Lesen: ANON + Session (RLS: eigene + Downline). Schreiben: eigene.
-- =====================================================================

create table if not exists public.account_tasks (
  id          uuid primary key default gen_random_uuid(),
  partner_id  uuid not null references public.partners(id) on delete cascade,
  account_id  uuid not null references public.accounts(id) on delete cascade,
  title       text not null,
  due_date    date,
  done        boolean not null default false,
  created_at  timestamptz not null default now()
);

create index if not exists account_tasks_account_idx
  on public.account_tasks (account_id, done, due_date);
create index if not exists account_tasks_partner_open_idx
  on public.account_tasks (partner_id, done, due_date);

alter table public.account_tasks enable row level security;

drop policy if exists account_tasks_select on public.account_tasks;
create policy account_tasks_select on public.account_tasks
  for select using (
    fn_is_admin()
    or partner_id = current_partner_id()
    or fn_is_descendant(partner_id)
  );

drop policy if exists account_tasks_write on public.account_tasks;
create policy account_tasks_write on public.account_tasks
  for all using (fn_is_admin() or partner_id = current_partner_id())
  with check (fn_is_admin() or partner_id = current_partner_id());

grant select, insert, update, delete on public.account_tasks to authenticated;
