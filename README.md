# RSG Partner-Cockpit

Produktives Dashboard für selbstständige Vertriebspartner:innen der RSG.
Held des Screens ist der **wachsende wiederkehrende Bestand**. Daneben:
Provisionen, Pipeline, Karrierestufe und Team.

Gebaut mit **Next.js 14 (App Router)**, **TypeScript**, **Tailwind**,
**@supabase/ssr** und **Recharts**.

## Architektur

- **Geschützte Route-Group** `app/(cockpit)` hinter Supabase-Auth.
  Kein eingeloggter Partner → Redirect auf `/cockpit/login` (via `middleware.ts`).
- **Auth** über `@supabase/ssr` (`createServerClient` / `createBrowserClient`).
  Login per **Magic Link** oder **E-Mail/Passwort**. Mapping auf
  `partners.auth_user_id`.
- **Datenzugriff ausschließlich** mit **ANON-Key + User-Session**. RLS liefert
  automatisch nur eigene Daten + Downline. **Niemals** der Service-Role-Key im
  Frontend.
- **Datenladen in Server Components** (`lib/data.ts`).

### Datenquellen (read-only)

| Sektion                     | Quelle                                                                 |
| --------------------------- | --------------------------------------------------------------------- |
| KPIs & Bestand              | `v_partner_bestand`                                                    |
| Provisionsübersicht         | `v_partner_earnings`                                                   |
| Leaderboard                 | `v_leaderboard`                                                        |
| Pipeline                    | `deals` (join `customers`, `products`)                                 |
| Karriere / Override-Nudge   | `v_override_eligibility` + `career_levels`                             |
| Team / Downline             | `partners where upline_id = eigene id`                                 |
| Bestands-Wachstumskurve     | `commissions` · `sum(amount) where ctype='closer_recurring'` je Monat |

## Sektionen

1. **Hero** – wiederkehrender Bestand (€/Monat) + Wachstums-Area-Chart
2. **KPI-Reihe** – aktive Kund:innen, Provision diesen Monat, Stornoreserve, Override-Status
3. **Override-Nudge** – nur sichtbar wenn `override_pausiert > 0`
4. **Pipeline** · 5. **Karriere** · 6. **Leaderboard** · 7. **Team/Downline**

## Setup

```bash
npm install
cp .env.example .env.local   # Supabase-Werte eintragen
npm run dev
```

### Environment

| Variable                        | Zweck                                  |
| ------------------------------- | -------------------------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`      | Supabase Projekt-URL                   |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Anon-Key (öffentlich, RLS-geschützt)   |
| `NEXT_PUBLIC_COCKPIT_USE_MOCK`  | optional `true` → erzwingt Mock-Modus  |

> **Mock-Fallback:** Ohne gesetzte Supabase-ENV läuft das Cockpit mit
> realistischen Demo-Daten (`lib/mock.ts`), damit Build & Vercel-Preview ohne
> DB-Zugang funktionieren. Ein Hinweisbanner zeigt den Demo-Modus an.

## Deployment

Feature-Branch → Vercel-**Preview**. ENV in Vercel hinterlegen. **Niemals auf
Production.** Beim Setzen echter Supabase-ENV greift automatisch der Auth-Guard
und der Live-Datenzugriff.
