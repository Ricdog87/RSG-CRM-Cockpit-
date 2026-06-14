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
