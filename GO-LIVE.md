# RSG CRM – Go-Live Checkliste

Von der Demo zum Echtbetrieb in 4 Schritten. Geschätzte Zeit: 15–20 Min.

---

## 0) Voraussetzung: RSG-Basisschema in Supabase

Die CRM-Erweiterungen bauen auf einem Basisschema auf (Tabelle `partners` +
Funktionen `current_partner_id()`, `fn_is_admin()`, `fn_is_descendant()` sowie
die Dashboard-Views `v_partner_bestand`, `v_partner_earnings`,
`v_override_eligibility`, `v_leaderboard` und die Stammtabellen
`career_levels`, `products`, `customers`, `deals`, `commissions`).

- **Frisches Supabase-Projekt (z.B. neuer Free-Account)?** → im SQL-Editor
  **`supabase/00_base_schema.sql`** ausführen. Das Skript legt alles oben
  Genannte an (inkl. RLS + kanonischer Stammdaten), ist idempotent und wurde
  gegen echtes Postgres 16 getestet (Basis + CRM + RLS-Isolation).
- **Eigenes RSG-Vertriebsschema schon vorhanden?** (z.B. weil n8n bereits
  gegen Supabase läuft) → Schritt 0 überspringen und direkt zu Schritt 1.

> Reihenfolge im SQL-Editor: **`00_base_schema.sql`** → dann Schritt 1.

---

## 1) CRM-Migrationen einspielen

Im **Supabase Dashboard → SQL Editor** die Datei **`supabase/_all_crm_migrations.sql`**
einmal komplett ausführen (enthält CRM, E-Mail-Tracking, Notizen, Aufgaben,
Kontakte, Automatisierungen – idempotent, in korrekter Reihenfolge).

Alternativ einzeln in dieser Reihenfolge:
`rsg_crm_schema` → `rsg_email_schema` → `rsg_notes_schema` →
`rsg_tasks_schema` → `rsg_contacts_schema` → `rsg_automations_schema`.

---

## 2) Auth: Partner mit Login verbinden

Damit der Login funktioniert, muss jede:r Partner:in einen Supabase-Auth-User
haben, dessen ID in `partners.auth_user_id` steht.

- **Supabase → Authentication → Users**: User anlegen (oder Magic Link nutzen).
- In `partners` die Spalte `auth_user_id` auf die User-UUID setzen
  (Spalte muss existieren – Teil des Basisschemas).
- E-Mail/Passwort **oder** Magic Link sind in Supabase → Authentication → Providers zu aktivieren.

---

## 3) Environment-Variablen in Vercel

**Vercel → Project `rsg-crm-cockpit` → Settings → Environment Variables**
(Production), danach **Redeploy**:

| Variable | Pflicht | Zweck |
| --- | :---: | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | ✅ | Supabase Projekt-URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | ✅ | Anon-Key (RLS-geschützt) |
| `ANTHROPIC_API_KEY` | ➖ | KI (Lead Intelligence, Co-Pilot, Scoring) |
| `PERPLEXITY_API_KEY` | ➖ | Web-Recherche für Leads |
| `OPENROUTER_API_KEY` | ➖ | Alternativer LLM-Provider statt Anthropic |
| `SUPABASE_SERVICE_ROLE_KEY` | ➖ | **nur** für E-Mail-Webhook (server-only!) |
| `EMAIL_INBOUND_DOMAIN` | ➖ | Domain der BCC-Adresse |
| `EMAIL_WEBHOOK_SECRET` | ➖ | Schutz des Inbound-Webhooks |

> `SUPABASE_SERVICE_ROLE_KEY` niemals als `NEXT_PUBLIC` setzen.

---

## 4) E-Mail-Tracking (optional)

1. Inbound-Mail-Dienst (SendGrid Inbound Parse / Mailgun Routes / Postmark)
   auf eine (Sub-)Domain zeigen lassen (MX-Eintrag + Domain-Verifizierung).
2. Dessen Inbound-Webhook auf `https://<deine-app>/api/email/inbound` setzen
   (optional Header `x-webhook-secret: <EMAIL_WEBHOOK_SECRET>`).
3. `EMAIL_INBOUND_DOMAIN` + `SUPABASE_SERVICE_ROLE_KEY` in Vercel hinterlegen.
4. Im CRM unter **Postfach** die persönliche BCC-Adresse kopieren und ins BCC setzen.

---

## 5) Funktionstest

Nach Redeploy auf **/cockpit/einstellungen** prüfen (Ampel grün):
Supabase verbunden · KI verbunden · E-Mail schreibbereit. Dann:

- Account anlegen (KI-Auto-Ausfüllen + Dubletten-Schutz),
- Chance anlegen + Phase auf „Gewonnen" → Onboarding-Aufgabe erscheint,
- Lead Intelligence / Co-Pilot testen,
- (falls E-Mail) Testmail mit BCC senden → erscheint unter Postfach + Account.
