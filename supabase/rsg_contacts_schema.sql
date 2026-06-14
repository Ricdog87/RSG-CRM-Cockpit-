-- =====================================================================
-- RSG CRM – Kontakte (Ansprechpartner:innen) je Account
-- =====================================================================
-- Additive Migration. Nach rsg_crm_schema.sql ausführen.
-- Lesen: ANON + Session (RLS: eigene + Downline). Schreiben: eigene.
-- =====================================================================

create table if not exists public.account_contacts (
  id          uuid primary key default gen_random_uuid(),
  partner_id  uuid not null references public.partners(id) on delete cascade,
  account_id  uuid not null references public.accounts(id) on delete cascade,
  name        text not null,
  role        text,
  email       text,
  phone       text,
  created_at  timestamptz not null default now()
);

create index if not exists account_contacts_account_idx
  on public.account_contacts (account_id, created_at);

alter table public.account_contacts enable row level security;

drop policy if exists account_contacts_select on public.account_contacts;
create policy account_contacts_select on public.account_contacts
  for select using (
    fn_is_admin()
    or partner_id = current_partner_id()
    or fn_is_descendant(partner_id)
  );

drop policy if exists account_contacts_write on public.account_contacts;
create policy account_contacts_write on public.account_contacts
  for all using (fn_is_admin() or partner_id = current_partner_id())
  with check (fn_is_admin() or partner_id = current_partner_id());

grant select, insert, update, delete on public.account_contacts to authenticated;
