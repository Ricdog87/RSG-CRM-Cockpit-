-- =====================================================================
-- RSG CRM – ALLE additiven Migrationen in einer Datei
-- =====================================================================
-- VORAUSSETZUNG: Das RSG-Basisschema läuft bereits (Tabelle public.partners
--   sowie die Funktionen current_partner_id(), fn_is_admin(),
--   fn_is_descendant(partner_id)). Diese kommen aus rsg_vertrieb_schema.sql
--   + rsg_engine_rpc.sql (von RSG) und sind NICHT Teil dieser Datei.
--
-- Diese Datei einmal im Supabase SQL-Editor ausführen. Idempotent
--   (create table if not exists / drop policy if exists).
-- =====================================================================


-- ───────────────────────────────────────────────────────────────────
-- rsg_crm_schema.sql
-- ───────────────────────────────────────────────────────────────────
-- =====================================================================
-- RSG CRM – Schema für das hausinterne CRM (HubSpot-Ablösung)
-- =====================================================================
-- Additive Migration. Setzt das bestehende RSG-Vertriebsschema voraus
-- (Tabelle public.partners sowie die Helfer current_partner_id(),
-- fn_is_admin(), fn_is_descendant(partner_id)).
--
-- Reihenfolge: in Supabase NACH rsg_vertrieb_schema.sql und
-- rsg_engine_rpc.sql ausführen.
--
-- Sicherheit: Jede Tabelle gehört über partner_id einer Partner:in.
-- RLS gibt automatisch nur eigene Daten + Downline frei (Admins alles).
-- Das Frontend liest ausschließlich mit ANON-Key + User-Session.
-- =====================================================================

-- ---------- Segmente (KI-Zielgruppen) --------------------------------
create table if not exists public.segments (
  id          uuid primary key default gen_random_uuid(),
  partner_id  uuid not null references public.partners(id) on delete cascade,
  name        text not null,
  description text,
  top_product text,
  created_at  timestamptz not null default now()
);

-- ---------- Accounts (Unternehmen / Kunden) --------------------------
create table if not exists public.accounts (
  id            uuid primary key default gen_random_uuid(),
  partner_id    uuid not null references public.partners(id) on delete cascade,
  name          text not null,
  branche       text,
  segment       text,
  line          text not null default 'ki'
                  check (line in ('ki','recruiting')),
  lifecycle     text not null default 'lead'
                  check (lifecycle in ('lead','opportunity','kunde','bestand')),
  contact_name  text,
  contact_email text,
  mrr           numeric not null default 0,
  ort           text,
  since         date,
  created_at    timestamptz not null default now()
);
create index if not exists accounts_partner_idx on public.accounts (partner_id);

-- ---------- Opportunities (Sales-Pipeline) ---------------------------
create table if not exists public.opportunities (
  id             uuid primary key default gen_random_uuid(),
  partner_id     uuid not null references public.partners(id) on delete cascade,
  account_name   text not null,
  line           text not null default 'ki'
                   check (line in ('ki','recruiting')),
  title          text not null,
  value          numeric not null default 0,
  value_type     text not null default 'mrr'
                   check (value_type in ('mrr','fixed')),
  stage          text not null default 'neu'
                   check (stage in ('neu','qualifiziert','demo','angebot',
                                    'verhandlung','gewonnen','verloren')),
  probability    int not null default 0,
  owner          text,
  expected_close date,
  created_at     timestamptz not null default now()
);
create index if not exists opportunities_partner_idx on public.opportunities (partner_id);

-- ---------- KI-Projekte ---------------------------------------------
create table if not exists public.ki_projects (
  id           uuid primary key default gen_random_uuid(),
  partner_id   uuid not null references public.partners(id) on delete cascade,
  account_name text not null,
  product      text,
  segment      text,
  status       text not null default 'onboarding'
                 check (status in ('onboarding','live','optimierung',
                                   'pausiert','gekuendigt')),
  mrr          numeric not null default 0,
  go_live      date,
  health       text not null default 'neutral'
                 check (health in ('gut','neutral','risiko')),
  created_at   timestamptz not null default now()
);
create index if not exists ki_projects_partner_idx on public.ki_projects (partner_id);

-- ---------- Recruiting-Mandate --------------------------------------
create table if not exists public.recruiting_mandates (
  id              uuid primary key default gen_random_uuid(),
  partner_id      uuid not null references public.partners(id) on delete cascade,
  account_name    text not null,
  role            text not null,
  positions       int not null default 1,
  filled          int not null default 0,
  status          text not null default 'offen'
                    check (status in ('offen','in_arbeit','interviews',
                                      'besetzt','pausiert')),
  fee             numeric not null default 9999,
  candidate_count int not null default 0,
  deadline        date,
  created_at      timestamptz not null default now()
);
create index if not exists mandates_partner_idx on public.recruiting_mandates (partner_id);

-- ---------- Kandidaten (Recruiting-Pipeline) ------------------------
create table if not exists public.candidates (
  id              uuid primary key default gen_random_uuid(),
  partner_id      uuid not null references public.partners(id) on delete cascade,
  name            text not null,
  role            text,
  mandate_account text,
  stage           text not null default 'neu'
                    check (stage in ('neu','screening','interview','angebot',
                                     'platziert','abgelehnt')),
  source          text,
  updated_at      timestamptz not null default now(),
  created_at      timestamptz not null default now()
);
create index if not exists candidates_partner_idx on public.candidates (partner_id);

-- ---------- View: Segmente mit aggregierten Accounts/MRR ------------
create or replace view public.v_segments as
  select
    s.id,
    s.partner_id,
    s.name,
    s.description,
    s.top_product,
    coalesce(a.cnt, 0)  as accounts,
    coalesce(a.mrr, 0)  as mrr
  from public.segments s
  left join lateral (
    select count(*) as cnt, sum(mrr) as mrr
    from public.accounts ac
    where ac.partner_id = s.partner_id
      and ac.segment = s.name
  ) a on true;

-- =====================================================================
-- Row Level Security: eigene Daten + Downline (Admins alles)
-- =====================================================================
do $$
declare
  t text;
begin
  foreach t in array array[
    'segments','accounts','opportunities','ki_projects',
    'recruiting_mandates','candidates'
  ]
  loop
    execute format('alter table public.%I enable row level security;', t);

    execute format($p$
      drop policy if exists %1$s_select on public.%1$I;
      create policy %1$s_select on public.%1$I
        for select using (
          fn_is_admin()
          or partner_id = current_partner_id()
          or fn_is_descendant(partner_id)
        );
    $p$, t);

    execute format($p$
      drop policy if exists %1$s_write on public.%1$I;
      create policy %1$s_write on public.%1$I
        for all using (
          fn_is_admin() or partner_id = current_partner_id()
        ) with check (
          fn_is_admin() or partner_id = current_partner_id()
        );
    $p$, t);
  end loop;
end $$;

-- View erbt RLS der Basistabellen; nur Leserecht freigeben.
grant select on public.v_segments to authenticated, anon;

-- ───────────────────────────────────────────────────────────────────
-- rsg_email_schema.sql
-- ───────────────────────────────────────────────────────────────────
-- =====================================================================
-- RSG CRM – E-Mail-Tracking (BCC) Schema
-- =====================================================================
-- Additive Migration. Nach rsg_crm_schema.sql ausführen.
--
-- Funktion: Jede:r Partner:in erhält eine persönliche BCC-Adresse
--   track+<token>@<EMAIL_INBOUND_DOMAIN>. Gesendete Mails, die diese Adresse
--   im BCC haben, werden vom Inbound-Mail-Provider an /api/email/inbound
--   geleitet, dort dem passenden Account zugeordnet (intelligenter Abgleich)
--   und als email_activities gespeichert.
--
-- Sicherheit:
--   • Lesen: ANON-Key + Session, RLS liefert eigene + Downline.
--   • Schreiben (Webhook): NUR über Service-Role (server-seitig, kein Frontend),
--     analog zu n8n. Daher KEINE Insert-Policy auf email_activities nötig –
--     Service-Role umgeht RLS.
-- =====================================================================

-- ---------- Persönliche Inbox-Tokens (BCC-Adresse) -------------------
create table if not exists public.partner_inbox (
  partner_id uuid primary key references public.partners(id) on delete cascade,
  token      text not null unique,
  created_at timestamptz not null default now()
);

-- ---------- Getrackte E-Mails ---------------------------------------
create table if not exists public.email_activities (
  id          uuid primary key default gen_random_uuid(),
  partner_id  uuid not null references public.partners(id) on delete cascade,
  account_id  uuid references public.accounts(id) on delete set null,
  message_id  text,
  direction   text not null default 'outbound'
                check (direction in ('outbound', 'inbound')),
  from_email  text,
  from_name   text,
  to_email    text,
  subject     text,
  snippet     text,
  body        text,
  occurred_at timestamptz not null default now(),
  created_at  timestamptz not null default now()
);

create index if not exists email_activities_partner_idx
  on public.email_activities (partner_id, occurred_at desc);
create index if not exists email_activities_account_idx
  on public.email_activities (account_id, occurred_at desc);
-- Dublettenschutz je Partner:in über die Message-ID.
create unique index if not exists email_activities_msgid_uniq
  on public.email_activities (partner_id, message_id)
  where message_id is not null;

-- =====================================================================
-- RLS
-- =====================================================================
alter table public.partner_inbox enable row level security;
alter table public.email_activities enable row level security;

-- partner_inbox: eigene Zeile lesen + anlegen (Token lazy beim ersten Aufruf).
drop policy if exists partner_inbox_select on public.partner_inbox;
create policy partner_inbox_select on public.partner_inbox
  for select using (fn_is_admin() or partner_id = current_partner_id());

drop policy if exists partner_inbox_insert on public.partner_inbox;
create policy partner_inbox_insert on public.partner_inbox
  for insert with check (partner_id = current_partner_id());

-- email_activities: eigene + Downline lesen (Schreiben nur via Service-Role).
drop policy if exists email_activities_select on public.email_activities;
create policy email_activities_select on public.email_activities
  for select using (
    fn_is_admin()
    or partner_id = current_partner_id()
    or fn_is_descendant(partner_id)
  );

grant select, insert on public.partner_inbox to authenticated;
grant select on public.email_activities to authenticated;

-- ───────────────────────────────────────────────────────────────────
-- rsg_notes_schema.sql
-- ───────────────────────────────────────────────────────────────────
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

-- ───────────────────────────────────────────────────────────────────
-- rsg_tasks_schema.sql
-- ───────────────────────────────────────────────────────────────────
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

-- ───────────────────────────────────────────────────────────────────
-- rsg_contacts_schema.sql
-- ───────────────────────────────────────────────────────────────────
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

-- ───────────────────────────────────────────────────────────────────
-- rsg_automations_schema.sql
-- ───────────────────────────────────────────────────────────────────
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
