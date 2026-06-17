-- =====================================================================
-- RSG CRM – 21_ki_metrics.sql
-- =====================================================================
-- Monatliche Betriebs-/Performance-Kennzahlen je KI-Projekt
-- (Anrufe, Automatisierung, Containment, Eskalationen, Uptime,
--  Token-Verbrauch & -Kosten, CSAT). Grundlage für objektive Health.
-- Idempotent – im Supabase SQL-Editor ausführen.
-- =====================================================================

create table if not exists public.ki_metrics (
  id                 uuid primary key default gen_random_uuid(),
  partner_id         uuid not null references public.partners(id) on delete cascade,
  project_id         uuid not null references public.ki_projects(id) on delete cascade,
  period             text not null,           -- 'yyyy-mm'
  calls              int,                      -- Anrufe / Conversations
  automation_rate    numeric,                  -- % automatisiert
  containment_rate   numeric,                  -- % ohne Mensch gelöst
  escalations        int,                      -- an Mensch eskaliert
  avg_handle_seconds int,                      -- ø Bearbeitungszeit (s)
  uptime             numeric,                  -- % Verfügbarkeit
  tokens             bigint,                   -- Token-Verbrauch
  token_cost         numeric,                  -- Token-Kosten (€)
  csat               numeric,                  -- Zufriedenheit (0–100)
  notes              text,
  created_at         timestamptz not null default now(),
  unique (project_id, period)
);
create index if not exists idx_ki_metrics_project on public.ki_metrics(project_id);

alter table public.ki_metrics enable row level security;
drop policy if exists ki_mt_select on public.ki_metrics;
create policy ki_mt_select on public.ki_metrics for select
  using (public.fn_is_admin() or partner_id = public.current_partner_id()
         or public.fn_is_descendant(partner_id));
drop policy if exists ki_mt_insert on public.ki_metrics;
create policy ki_mt_insert on public.ki_metrics for insert
  with check (partner_id = public.current_partner_id());
drop policy if exists ki_mt_update on public.ki_metrics;
create policy ki_mt_update on public.ki_metrics for update
  using (partner_id = public.current_partner_id() or public.fn_is_admin());
drop policy if exists ki_mt_delete on public.ki_metrics;
create policy ki_mt_delete on public.ki_metrics for delete
  using (partner_id = public.current_partner_id() or public.fn_is_admin());
grant select, insert, update, delete on public.ki_metrics to authenticated;
