-- =====================================================================
-- RSG CRM – 15_invoices.sql
-- =====================================================================
-- Honorar-Rechnungen an den Kunden je Mandat/Platzierung – an den
-- Zahlungsplan gekoppelt (Anzahlung, Restbetrag, 50/50-Split).
-- Idempotent – im Supabase SQL-Editor ausführen.
-- =====================================================================

create table if not exists public.invoices (
  id           uuid primary key default gen_random_uuid(),
  partner_id   uuid not null references public.partners(id) on delete cascade,
  mandate_id   uuid references public.recruiting_mandates(id) on delete set null,
  placement_id uuid references public.placements(id) on delete set null,
  account_name text,
  role         text,
  label        text,            -- z.B. „Anzahlung", „2. Rate (3 Monate)"
  amount       numeric not null default 0,
  issue_date   date,
  due_date     date,
  paid_date    date,
  invoice_no   text,
  status       text not null default 'entwurf'
                 check (status in ('entwurf','gestellt','bezahlt')),
  notes        text,
  created_at   timestamptz not null default now()
);

create index if not exists idx_invoices_mandate on public.invoices(mandate_id);
create index if not exists idx_invoices_placement on public.invoices(placement_id);
create index if not exists idx_invoices_status on public.invoices(status);

alter table public.invoices enable row level security;
drop policy if exists invoices_select on public.invoices;
create policy invoices_select on public.invoices for select
  using (public.fn_is_admin() or partner_id = public.current_partner_id()
         or public.fn_is_descendant(partner_id));
drop policy if exists invoices_insert on public.invoices;
create policy invoices_insert on public.invoices for insert
  with check (partner_id = public.current_partner_id());
drop policy if exists invoices_update on public.invoices;
create policy invoices_update on public.invoices for update
  using (partner_id = public.current_partner_id() or public.fn_is_admin());
drop policy if exists invoices_delete on public.invoices;
create policy invoices_delete on public.invoices for delete
  using (partner_id = public.current_partner_id() or public.fn_is_admin());
grant select, insert, update, delete on public.invoices to authenticated;
