-- =====================================================================
-- RSG CRM – Automatisierungen (Workflow-Regeln an/aus je Partner:in)
-- =====================================================================
-- Additive Migration. Nach rsg_crm_schema.sql ausführen.
-- Speichert nur den An/Aus-Status je Regel; die Logik läuft serverseitig
-- in den jeweiligen Aktionen/Webhooks.
-- =====================================================================

create table if not exists public.automations (
  partner_id uuid not null references public.partners(id) on delete cascade,
  key        text not null,
  enabled    boolean not null default true,
  updated_at timestamptz not null default now(),
  primary key (partner_id, key)
);

alter table public.automations enable row level security;

drop policy if exists automations_select on public.automations;
create policy automations_select on public.automations
  for select using (fn_is_admin() or partner_id = current_partner_id());

drop policy if exists automations_write on public.automations;
create policy automations_write on public.automations
  for all using (fn_is_admin() or partner_id = current_partner_id())
  with check (fn_is_admin() or partner_id = current_partner_id());

grant select, insert, update, delete on public.automations to authenticated;
