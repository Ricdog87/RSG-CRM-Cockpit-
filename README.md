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

## KI / Lead Intelligence

RSG-CRM ist als **intelligentes B2B-Lead-CRM** ausgelegt. Die KI-Schicht
(`lib/ai/*`) läuft **ausschließlich serverseitig** (Keys nie im Browser):

- **Brain:** Claude über das offizielle Anthropic-SDK (`claude-opus-4-8`,
  adaptives Denken), strenger JSON-Vertrag → Fit-Score, empfohlene Linie
  (RSG AI / Recruiting), Kaufsignale, Schmerzpunkte, Gesprächsaufhänger und ein
  fertiger Erstkontakt – zugeschnitten auf die beiden RSG-Geschäftslinien.
- **Web-Grounding (optional):** Perplexity (Sonar) reichert die Analyse mit
  aktuellen Unternehmensfakten an.
- **Provider-Wahl:** Ohne `ANTHROPIC_API_KEY`, aber mit `OPENROUTER_API_KEY`
  wird über OpenRouter geroutet. Ohne jeden Key liefert die Seite eine
  realistische **Demo-Analyse** (Banner sichtbar), damit die Preview läuft.
- Analysierte Leads lassen sich per Klick als CRM-Account übernehmen.

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
