-- =====================================================================
-- RSG CRM – 31_partner_rls_lockdown.sql  (VORSCHLAG – NICHT automatisch ausgeführt)
-- =====================================================================
-- Schließt das gemeldete Datenschutz-Leck: 6 PascalCase-Tabellen haben RLS
-- DEAKTIVIERT und sind damit über den Anon-Key voll lesbar/schreibbar –
-- darunter Passwort-Reset-Tokens und Audit-Logs.
--
-- WARUM SICHER:
--  - Die Next.js-App greift auf diese Tabellen NICHT über den Supabase-Client
--    zu (verifiziert: nur das snake_case `partners` wird genutzt).
--  - Diese Tabellen gehören zu einem separaten Auth/Billing-Backend (Prisma-
--    Stil), das per Service-Role bzw. direkter Postgres-Verbindung zugreift –
--    beide UMGEHEN RLS. RLS-aktivieren betrifft nur anon/authenticated.
--  - „RLS an, keine Policy" = deny-all für anon/authenticated → Leck zu,
--    legitimer Backend-Zugriff unberührt.
--
-- VOR DEM AUSFÜHREN BITTE BESTÄTIGEN:
--  - Das Auth/Billing-Backend verbindet sich über den Postgres-/Service-Role-
--    Connection-String (typisch für Prisma: DATABASE_URL mit DB-User). Falls es
--    stattdessen den ANON-Key nutzt, NICHT ausführen – dann brauchen wir
--    gezielte Policies (sag Bescheid).
-- =====================================================================

begin;

alter table public."PartnerAccount"            enable row level security;
alter table public."PartnerPasswordResetToken" enable row level security;
alter table public."PartnerAuditLog"           enable row level security;
alter table public."PartnerTier"               enable row level security;
alter table public."PartnerPricing"            enable row level security;
alter table public."PartnerCustomer"           enable row level security;

-- Defense-in-Depth: Client-Rollen explizit entrechten (RLS deny-all reicht zwar,
-- aber so ist auch ohne RLS-Auswertung kein Zugriff möglich).
revoke all on public."PartnerAccount"            from anon, authenticated;
revoke all on public."PartnerPasswordResetToken" from anon, authenticated;
revoke all on public."PartnerAuditLog"           from anon, authenticated;
revoke all on public."PartnerTier"               from anon, authenticated;
revoke all on public."PartnerPricing"            from anon, authenticated;
revoke all on public."PartnerCustomer"           from anon, authenticated;

commit;

-- Rollback (falls das Backend doch den Anon-Key nutzt):
--   alter table public."PartnerAccount" disable row level security;  -- usw.
--   grant all on public."PartnerAccount" to anon, authenticated;     -- usw.
