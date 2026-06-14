-- =====================================================================
-- RSG CRM – Kalender & einheitliche Aufgaben/Termine
-- =====================================================================
-- Additive Migration. Nach rsg_crm_schema.sql ausführen.
-- crm_tasks ist das neue, kanonische Aufgaben-/Termin-Modell und kann an
-- Kunde (customer), Projekt (project), Kandidat (candidate) oder nichts
-- gebunden werden. Ersetzt account_tasks im App-Code (account_tasks bleibt
-- bestehen, wird aber nicht mehr beschrieben).
--
-- Lesen: ANON + Session (RLS: eigene + Downline). Schreiben: eigene.
-- ICS-Feed (öffentlich, per Token) liest über Service-Role.
-- =====================================================================

create table if not exists public.crm_tasks (
  id            uuid primary key default gen_random_uuid(),
  partner_id    uuid not null references public.partners(id) on delete cascade,
  related_type  text not null default 'none'
                  check (related_type in ('customer', 'project', 'candidate', 'none')),
  related_id    text,
  related_label text,
  title         text not null,
  notes         text,
  due_date      date,
  due_time      text,
  done          boolean not null default false,
  google_event_id text,
  created_at    timestamptz not null default now()
);

create index if not exists crm_tasks_partner_idx on public.crm_tasks (partner_id, done, due_date);
create index if not exists crm_tasks_related_idx on public.crm_tasks (related_type, related_id);
create index if not exists crm_tasks_due_idx on public.crm_tasks (partner_id, due_date);

alter table public.crm_tasks enable row level security;

drop policy if exists crm_tasks_select on public.crm_tasks;
create policy crm_tasks_select on public.crm_tasks
  for select using (
    fn_is_admin() or partner_id = current_partner_id() or fn_is_descendant(partner_id)
  );

drop policy if exists crm_tasks_write on public.crm_tasks;
create policy crm_tasks_write on public.crm_tasks
  for all using (fn_is_admin() or partner_id = current_partner_id())
  with check (fn_is_admin() or partner_id = current_partner_id());

grant select, insert, update, delete on public.crm_tasks to authenticated;

-- ---------- Kalender-Token für den ICS-Feed --------------------------
create table if not exists public.calendar_tokens (
  partner_id uuid primary key references public.partners(id) on delete cascade,
  token      text not null unique,
  created_at timestamptz not null default now()
);

alter table public.calendar_tokens enable row level security;

drop policy if exists calendar_tokens_select on public.calendar_tokens;
create policy calendar_tokens_select on public.calendar_tokens
  for select using (fn_is_admin() or partner_id = current_partner_id());

drop policy if exists calendar_tokens_insert on public.calendar_tokens;
create policy calendar_tokens_insert on public.calendar_tokens
  for insert with check (partner_id = current_partner_id());

grant select, insert on public.calendar_tokens to authenticated;
