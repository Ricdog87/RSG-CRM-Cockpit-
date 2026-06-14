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
