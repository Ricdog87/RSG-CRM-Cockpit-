-- =====================================================================
-- RSG CRM – Notizen je Account
-- =====================================================================
-- Additive Migration. Nach rsg_crm_schema.sql ausführen.
-- Lesen: ANON + Session (RLS: eigene + Downline). Schreiben: eigene.
-- =====================================================================

create table if not exists public.account_notes (
  id          uuid primary key default gen_random_uuid(),
  partner_id  uuid not null references public.partners(id) on delete cascade,
  account_id  uuid not null references public.accounts(id) on delete cascade,
  body        text not null,
  created_at  timestamptz not null default now()
);

create index if not exists account_notes_account_idx
  on public.account_notes (account_id, created_at desc);

alter table public.account_notes enable row level security;

drop policy if exists account_notes_select on public.account_notes;
create policy account_notes_select on public.account_notes
  for select using (
    fn_is_admin()
    or partner_id = current_partner_id()
    or fn_is_descendant(partner_id)
  );

drop policy if exists account_notes_insert on public.account_notes;
create policy account_notes_insert on public.account_notes
  for insert with check (partner_id = current_partner_id());

drop policy if exists account_notes_delete on public.account_notes;
create policy account_notes_delete on public.account_notes
  for delete using (fn_is_admin() or partner_id = current_partner_id());

grant select, insert, delete on public.account_notes to authenticated;
