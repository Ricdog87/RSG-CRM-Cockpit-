# RSG CRM · Partner-Cockpit

Hausinternes CRM der RSG (HubSpot-Ablösung) über **beide Geschäftslinien** –
**RSG AI** (KI-Telefonassistenz & Automatisierung) und **RSG Recruiting**
(Personalvermittlung zum Festpreis). Held des Partner-Bereichs ist der
**wachsende wiederkehrende Bestand**.

Gebaut mit **Next.js 14 (App Router)**, **TypeScript**, **Tailwind**,
**@supabase/ssr**, **Recharts** und **Poppins**.

## Bereiche

| Gruppe | Bereich | Quelle |
| --- | --- | --- |
| Start | **Übersicht** | Partner-Cockpit (Hero-Bestand, KPIs, Override, Vorschauen) |
| KI | **Lead Intelligence** | Claude bewertet B2B-Leads (Fit-Score, Linie, Signale, Erstkontakt) |
| Vertrieb | **Sales-Pipeline** | `opportunities` – Projekt-Chancen (Kanban, beide Linien) |
| | **Kunden** | `accounts` – Customer Management (Kontakte, Segment, Lifecycle) |
| | **Segmente** | `v_segments` – KI-Zielgruppen mit Accounts + MRR |
| Projekte | **KI & Telefonassistenz** | `ki_projects` – Status, Health, MRR |
| | **Personalvermittlung** | `recruiting_mandates` – Besetzungsfortschritt |
| | **Kandidaten** | `candidates` – Recruiting-Pipeline (Kanban) |
| Partner | **Team · Provisionen · Karriere** | Partner-Cockpit-Views |

## Architektur & Sicherheit

- **Geschützte Route-Group** `app/(cockpit)` hinter Supabase-Auth
  (`middleware.ts`). Ohne Session → Redirect auf `/cockpit/login`. Die
  authentifizierten Seiten liegen in der inneren Group `(app)` mit der
  App-Shell (Sidebar / Topbar / Mobile-Nav); die Login-Seite bleibt ohne Shell.
- **Auth** via `@supabase/ssr` (Magic Link oder E-Mail/Passwort), Mapping auf
  `partners.auth_user_id`.
- **Datenzugriff ausschließlich** mit **ANON-Key + User-Session**. RLS liefert
  automatisch nur eigene Daten + Downline. **Niemals** der Service-Role-Key im
  Frontend (den nutzt nur n8n serverseitig).
- **Laden in Server Components** (`lib/data.ts` für das Partner-Cockpit,
  `lib/crm-data.ts` für die CRM-Entitäten).

### Datenquellen

**Partner-Cockpit (read-only Views):** `v_partner_bestand`,
`v_partner_earnings`, `v_leaderboard`, `deals` (+`customers`,`products`),
`v_override_eligibility` + `career_levels`, `partners` (`upline_id`),
`commissions` (`closer_recurring` → 12-Monats-Kurve; laufender Monat → KPI).

**CRM (Tabellen, RLS-geschützt):** `accounts`, `opportunities`, `ki_projects`,
`recruiting_mandates`, `candidates`, `segments` (+ View `v_segments`).

> **Mock-Fallback:** Ohne Supabase-ENV – oder solange die CRM-Tabellen fehlen –
> rendern alle Bereiche mit realistischen Demo-Daten (`lib/mock.ts`,
> `lib/crm-mock.ts`), damit Build & Vercel-Preview ohne DB funktionieren. Ein
> Banner zeigt den Demo-Modus.

## Setup

```bash
npm install
cp .env.example .env.local   # Supabase-Werte eintragen
npm run dev
```

### Supabase-Migrationen (in dieser Reihenfolge)

1. `rsg_vertrieb_schema.sql` (bestehendes Vertriebsschema, von RSG)
2. `rsg_engine_rpc.sql` (RPC-Wrapper, von RSG)
3. `supabase/rsg_crm_schema.sql` (CRM-Tabellen + RLS + `v_segments`)
4. `supabase/rsg_email_schema.sql` (E-Mail-Tracking: `partner_inbox`, `email_activities`)
5. `supabase/rsg_notes_schema.sql` (Notizen je Account: `account_notes`)
6. `supabase/rsg_tasks_schema.sql` (Aufgaben je Account: `account_tasks`)
7. `supabase/rsg_contacts_schema.sql` (Ansprechpartner:innen: `account_contacts`)
8. `supabase/rsg_automations_schema.sql` (Workflow-Schalter: `automations`)

### Environment

| Variable | Zweck |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase Projekt-URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Anon-Key (öffentlich, RLS-geschützt) |
| `NEXT_PUBLIC_COCKPIT_USE_MOCK` | optional `true` → erzwingt Mock-Modus |
| `ANTHROPIC_API_KEY` | KI-Brain (Claude Opus 4.8) für Lead Intelligence – **serverseitig** |
| `AI_MODEL` | optional, Default `claude-opus-4-8` |
| `PERPLEXITY_API_KEY` | optional, web-gestützte Lead-Recherche |
| `OPENROUTER_API_KEY` | optional, alternativer LLM-Provider statt Anthropic |

## KI-Suite (intelligentes B2B-Lead-CRM)

Die KI-Schicht (`lib/ai/*`) läuft **ausschließlich serverseitig** (Keys nie im
Browser). **Brain:** Claude über das offizielle Anthropic-SDK
(`claude-opus-4-8`, adaptives Denken). **Optional:** Perplexity (Sonar) für
web-gestützte Recherche, OpenRouter als alternativer LLM-Provider. **Ohne Key**
greift überall ein realistischer Demo-/Heuristik-Modus (Banner sichtbar).

| Feature | Ort | Was es tut |
| --- | --- | --- |
| **CRM Co-Pilot** | Topbar (überall) | Frag dein CRM in natürlicher Sprache – Antwort nur aus deinem Kontext |
| **Lead-Discovery** | `/cockpit/leads` | ICP eingeben → KI schlägt Ziel-Accounts vor → Import |
| **Lead Intelligence** | `/cockpit/leads` | Unternehmen → Fit-Score, Linie, Signale, Erstkontakt |
| **Account-Anreicherung** | Kunden-Detailseite | KI-Analyse für bestehende Accounts |
| **Pipeline-Scoring** | Sales-Board | Score + nächste beste Aktion je Chance |
| **Bulk-Priorisierung** | Sales-Seite | „Heute zuerst" – sortierte Tagesliste |

Geschlossene Schleife **finden → bewerten → priorisieren → pflegen → fragen**.
Analysierte Leads/Kandidaten lassen sich per Klick als CRM-Account übernehmen.

**Live schalten:** `ANTHROPIC_API_KEY` in Vercel setzen (optional
`PERPLEXITY_API_KEY` fürs Web-Grounding, `AI_MODEL`, oder `OPENROUTER_API_KEY`
als Alternative) → Redeploy.

## E-Mail-Tracking (BCC, wie HubSpot)

Jede:r Partner:in bekommt unter **Postfach** eine persönliche Adresse
`track+<token>@<EMAIL_INBOUND_DOMAIN>`. Setzt man sie ins **BCC** (Outlook/Gmail),
leitet ein **Inbound-Mail-Dienst** (provider-agnostisch: SendGrid Inbound Parse /
Mailgun Routes / Postmark Inbound …) die Mail an `POST /api/email/inbound`. Der
Webhook ordnet sie via **intelligentem Abgleich** (E-Mail/Domain, Dublettenschutz)
dem passenden Account zu und speichert sie in `email_activities` – sichtbar als
**Korrespondenz-Timeline** auf der Account-Detailseite.

- **Schreiben nur serverseitig** über `SUPABASE_SERVICE_ROLE_KEY` (Webhook,
  umgeht RLS – analog n8n). **Niemals im Frontend.** Lesen via ANON + RLS.
- Optionaler Webhook-Schutz: Header `x-webhook-secret` == `EMAIL_WEBHOOK_SECRET`.
- **Setup:** Inbound-Dienst auf eine (Sub-)Domain zeigen lassen, dessen
  Inbound-Webhook auf `https://<deine-app>/api/email/inbound` setzen,
  `EMAIL_INBOUND_DOMAIN` + `SUPABASE_SERVICE_ROLE_KEY` in Vercel hinterlegen.
- Ohne Setup: Demo-Adresse + Beispiel-Timeline.

## Provisionslogik

Das CRM **bucht keine Provisionen** – es zeigt nur, was Views/Ledger liefern.
Sätze, Stufen und Override richten sich nach der **Provisionsordnung (Anlage 1)**:
Karrierestufen RSG Partner → Senior Partner → Director → Equity Circle, Aufstieg
struktur-/leistungsbasiert, Override 5 % je Ebene (max. 2). Bei nicht erfüllter
Mindestaktivität ruht der Override (im System „pausiert").

## Deployment

Feature-Branch → Vercel-Preview (Git-Integration: Push deployt automatisch).
ENV in Vercel hinterlegen; mit gesetzten Supabase-Werten greift der Auth-Guard
und der Live-Datenzugriff (CRM + Partner-Cockpit).
