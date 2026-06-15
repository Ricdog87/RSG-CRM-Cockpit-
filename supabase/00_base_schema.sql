-- =====================================================================
-- RSG CRM – 00_base_schema.sql  (BASIS-SCHEMA, zuerst ausführen)
-- =====================================================================
-- Legt die Objekte an, die das Frontend (lib/data.ts) und die additiven
-- CRM-Migrationen (supabase/_all_crm_migrations.sql) VORAUSSETZEN, aber bisher
-- nicht im Repo enthalten waren:
--   • Tabellen: career_levels, products, partners, customers, deals, commissions
--   • Helfer:   current_partner_id(), fn_is_admin(), fn_is_descendant(uuid)
--   • Views:    v_partner_bestand, v_partner_earnings,
--               v_override_eligibility, v_leaderboard
--   • RLS:      eigene Daten + Downline (Admins alles)
--
-- Reihenfolge im Supabase SQL-Editor:
--   1) 00_base_schema.sql   (diese Datei)
--   2) _all_crm_migrations.sql
--   3) 01_seed.sql / Partner-Profil anlegen (siehe Block ganz unten)
--
-- Idempotent: mehrfaches Ausführen ist gefahrlos.
-- Spaltennamen sind 1:1 aus lib/data.ts abgeleitet – nicht umbenennen.
-- =====================================================================

create extension if not exists pgcrypto;

-- ───────────────────────── Stammdaten ───────────────────────────────

-- Karrierestufen (Quelle der Provisionslogik – NICHT im Code hartcodieren).
create table if not exists public.career_levels (
  level              int  primary key,
  name               text not null,
  override_levels    int  not null default 0,   -- erlaubte Override-Ebenen
  min_active_directs int  not null default 0     -- Mindestaktivität für Override
);

-- Produktkatalog (kanonisch laut rsg-ai.de/partner).
create table if not exists public.products (
  id            uuid primary key default gen_random_uuid(),
  name          text not null unique,
  setup_price   numeric,         -- einmalig (null = Custom/keine)
  monthly_price numeric,         -- wiederkehrend (null = keine)
  created_at    timestamptz not null default now()
);

-- ───────────────────────── Partner ──────────────────────────────────
-- Selbstreferenz über upline_id bildet den Vertriebsbaum (Downline).
create table if not exists public.partners (
  id           uuid primary key default gen_random_uuid(),
  auth_user_id uuid unique references auth.users(id) on delete set null,
  full_name    text not null,
  email        text,
  level_id     int  references public.career_levels(level),
  upline_id    uuid references public.partners(id) on delete set null,
  is_active    boolean not null default true,
  is_admin     boolean not null default false,
  created_at   timestamptz not null default now()
);
create index if not exists idx_partners_auth on public.partners(auth_user_id);
create index if not exists idx_partners_upline on public.partners(upline_id);

-- ───────────────────────── Kunden / Pipeline / Ledger ───────────────
create table if not exists public.customers (
  id         uuid primary key default gen_random_uuid(),
  partner_id uuid not null references public.partners(id) on delete cascade,
  product_id uuid references public.products(id),
  name       text not null,
  mrr        numeric not null default 0,
  status     text not null default 'aktiv',   -- aktiv|bestand|onboarding|storno_reserve|gekuendigt
  started_at date,
  created_at timestamptz not null default now()
);
create index if not exists idx_customers_partner on public.customers(partner_id);

create table if not exists public.deals (
  id             uuid primary key default gen_random_uuid(),
  partner_id     uuid not null references public.partners(id) on delete cascade,
  customer_id    uuid references public.customers(id) on delete set null,
  product_id     uuid references public.products(id),
  stage          text not null default 'neu',  -- neu|qualifiziert|angebot|verhandlung|gewonnen|verloren
  mrr_value      numeric not null default 0,
  probability    int not null default 0,
  expected_close date,
  updated_at     timestamptz not null default now(),
  created_at     timestamptz not null default now()
);
create index if not exists idx_deals_partner on public.deals(partner_id);

-- Provisions-Ledger. Speist Bestand, Earnings & Wachstumskurve.
create table if not exists public.commissions (
  id         uuid primary key default gen_random_uuid(),
  partner_id uuid not null references public.partners(id) on delete cascade,
  period     date not null,                    -- Abrechnungsmonat (YYYY-MM-01)
  amount     numeric not null default 0,
  ctype      text not null,                    -- closer_setup|closer_recurring|override|...
  status     text not null default 'offen',    -- offen|freigegeben|ausgezahlt|stornoreserve|pausiert
  created_at timestamptz not null default now()
);
create index if not exists idx_commissions_partner on public.commissions(partner_id, period);

-- ───────────────────────── Helfer-Funktionen ────────────────────────
-- SECURITY DEFINER: lösen die Identität auf, OHNE selbst RLS auszulösen
-- (verhindert Rekursion in den partners-Policies).

create or replace function public.current_partner_id()
returns uuid
language sql stable security definer set search_path = public, pg_temp
as $$
  select id from public.partners where auth_user_id = auth.uid() limit 1;
$$;

create or replace function public.fn_is_admin()
returns boolean
language sql stable security definer set search_path = public, pg_temp
as $$
  select coalesce(
    (select is_admin from public.partners where auth_user_id = auth.uid() limit 1),
    false
  );
$$;

-- Ist Partner p in der Downline der/des eingeloggten Partner:in (beliebige Tiefe)?
create or replace function public.fn_is_descendant(p uuid)
returns boolean
language sql stable security definer set search_path = public, pg_temp
as $$
  with recursive dl as (
    select id from public.partners where upline_id = public.current_partner_id()
    union all
    select c.id from public.partners c join dl on c.upline_id = dl.id
  )
  select exists (select 1 from dl where id = p);
$$;

-- ───────────────────────── Views (Dashboard) ────────────────────────
-- security_invoker=true → RLS der Basistabellen gilt für die:den Aufrufer:in
-- (Postgres 15 / Supabase). So sieht jede:r nur eigene Daten + Downline.

create or replace view public.v_partner_bestand
with (security_invoker = true) as
select
  p.id as partner_id,
  count(c.id) filter (where c.status in ('aktiv','bestand'))                  as aktive_kunden,
  coalesce(sum(c.mrr) filter (where c.status in ('aktiv','bestand')), 0)      as mrr_bestand,
  coalesce((
    select sum(k.amount) from public.commissions k
    where k.partner_id = p.id and k.ctype = 'closer_recurring'
      and k.period >= date_trunc('month', now())::date
  ), 0)                                                                       as monatl_bestandsprovision
from public.partners p
left join public.customers c on c.partner_id = p.id
group by p.id;

create or replace view public.v_partner_earnings
with (security_invoker = true) as
select
  p.id as partner_id,
  coalesce(sum(k.amount) filter (where k.status = 'freigegeben'), 0)   as offen_freigegeben,
  coalesce(sum(k.amount) filter (where k.status = 'ausgezahlt'), 0)    as ausgezahlt,
  coalesce(sum(k.amount) filter (where k.status = 'stornoreserve'), 0) as in_stornoreserve,
  coalesce(sum(k.amount) filter (where k.ctype = 'override'
                                   and k.status = 'pausiert'), 0)      as override_pausiert
from public.partners p
left join public.commissions k on k.partner_id = p.id
group by p.id;

create or replace view public.v_override_eligibility
with (security_invoker = true) as
select
  p.id        as partner_id,
  p.level_id,
  coalesce(cl.override_levels, 0)    as override_levels,
  coalesce(cl.min_active_directs, 0) as min_active_directs,
  (select count(*) from public.partners d
     where d.upline_id = p.id and d.is_active
       and exists (select 1 from public.customers cc
                   where cc.partner_id = d.id and cc.status in ('aktiv','bestand'))
  )           as active_direct_count,
  (select count(*) from public.customers c2
     where c2.partner_id = p.id and c2.status in ('aktiv','bestand')
  )           as own_active
from public.partners p
left join public.career_levels cl on cl.level = p.level_id;

create or replace view public.v_leaderboard
with (security_invoker = true) as
select
  p.id        as partner_id,
  p.full_name,
  p.level_id,
  coalesce(sum(c.mrr) filter (where c.status in ('aktiv','bestand')), 0) as mrr_bestand,
  coalesce((
    select sum(k.amount) from public.commissions k
    where k.partner_id = p.id and k.period >= (now() - interval '90 days')::date
  ), 0)       as provision_90d
from public.partners p
left join public.customers c on c.partner_id = p.id
group by p.id, p.full_name, p.level_id;

-- ───────────────────────── RLS + Policies ───────────────────────────

alter table public.partners    enable row level security;
alter table public.customers   enable row level security;
alter table public.deals       enable row level security;
alter table public.commissions enable row level security;
alter table public.career_levels enable row level security;
alter table public.products      enable row level security;

-- Partner: eigene Zeile + Downline (+ Admins alles).
drop policy if exists partners_select on public.partners;
create policy partners_select on public.partners for select
  using (
    public.fn_is_admin()
    or id = public.current_partner_id()
    or public.fn_is_descendant(id)
  );

-- Kunden / Deals / Provisionen: nur lesend im Frontend, eigene + Downline.
drop policy if exists customers_select on public.customers;
create policy customers_select on public.customers for select
  using (public.fn_is_admin() or partner_id = public.current_partner_id()
         or public.fn_is_descendant(partner_id));

drop policy if exists deals_select on public.deals;
create policy deals_select on public.deals for select
  using (public.fn_is_admin() or partner_id = public.current_partner_id()
         or public.fn_is_descendant(partner_id));

drop policy if exists commissions_select on public.commissions;
create policy commissions_select on public.commissions for select
  using (public.fn_is_admin() or partner_id = public.current_partner_id()
         or public.fn_is_descendant(partner_id));

-- Stammdaten: für alle lesbar (nicht sensibel; Quelle für UI/Provisionen).
drop policy if exists career_levels_read on public.career_levels;
create policy career_levels_read on public.career_levels for select using (true);
drop policy if exists products_read on public.products;
create policy products_read on public.products for select using (true);

-- Schreibzugriff auf die Ledger-/Stammtabellen erfolgt serverseitig
-- (Service-Role / Engine), daher hier KEINE insert/update-Policies für anon.

-- ───────────────────────── Grants (API-Rollen) ──────────────────────
grant select on
  public.partners, public.customers, public.deals, public.commissions,
  public.career_levels, public.products,
  public.v_partner_bestand, public.v_partner_earnings,
  public.v_override_eligibility, public.v_leaderboard
to anon, authenticated;

-- ───────────────────────── Seed: Stammdaten ─────────────────────────

insert into public.career_levels (level, name, override_levels, min_active_directs) values
  (1, 'RSG Partner',    0, 0),
  (2, 'Senior Partner', 1, 3),
  (3, 'Director',       2, 5),
  (4, 'Equity Circle',  2, 8)
on conflict (level) do nothing;

insert into public.products (name, setup_price, monthly_price) values
  ('Automatische Workflows',          1497, 297),
  ('Autonome KI-Agenten',             4997, 497),
  ('Voice-Agenten (RSG Voice Suite)', null, 797),  -- Setup Custom
  ('candiq',                          null, 99),
  ('Recruiting',                      9999, null)   -- Festpreis je Besetzung
on conflict (name) do nothing;

-- =====================================================================
-- NACH dem Signup: Partner-Profil mit dem Auth-User verknüpfen.
-- (ricardo@rsg-ai.de zuerst per Magic-Link/Passwort in Supabase Auth anlegen,
--  dann diesen Block ausführen.)
-- =====================================================================
-- insert into public.partners (auth_user_id, full_name, email, level_id, is_admin, is_active)
-- select u.id, 'Ricardo Serrano', u.email, 2, true, true
-- from auth.users u
-- where u.email = 'ricardo@rsg-ai.de'
-- on conflict (auth_user_id) do update
--   set full_name = excluded.full_name, is_admin = excluded.is_admin;

-- Verifikation (sollte 1 Zeile / deine partner_id liefern, sobald eingeloggt):
--   select public.current_partner_id();
--   select * from public.v_partner_bestand;
-- =====================================================================
