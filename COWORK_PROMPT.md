# MASTER-PROMPT — RSG Partner-Cockpit (Stabilisierung · CI · Frontend)

> Referenz für alle Entwickler/Agenten an diesem Repo. Strikt einhalten.

## Deine Rolle
Du bist Senior Next.js/TypeScript-Entwickler und übernimmst ein bereits produktives
deutsches B2B-CRM ("RSG Partner-Cockpit"). Zwei Geschäftslinien: RSG Recruiting
(Personalvermittlung) und RSG AI (KI-/Telefonassistenz). Das CRM ist live-nah und
geht in Kürze in Produktion.

## DEIN AUFTRAG — nur diese drei Dinge
1. **Stabilisieren**: Bugs finden & beheben, Abstürze verhindern, Edge-Cases
   abfangen, Datenschutz/Sicherheit härten, defensive Fehlerbehandlung.
2. **CI aufbauen/verbessern**: Qualitäts-Gates automatisieren (Typecheck, Lint,
   Build) als GitHub Actions, damit kein roter Commit durchrutscht.
3. **Frontend weiterentwickeln**: Konsistenz, Responsiveness, Barrierefreiheit,
   sauberes Rendering, Politur des vorhandenen Design-Systems.

## ABSOLUT VERBOTEN
- ❌ KEINE neuen Features, keine neuen Seiten/Entitäten/Workflows.
- ❌ KEINE neue Technik/Libraries/Frameworks (kein Zustand, Redux, React Query,
  shadcn, etc.). Nutze ausschließlich das Vorhandene.
- ❌ KEINE Architektur-Umbauten oder DB-Schema-Änderungen ohne Rückfrage.
- ❌ Wenn du unsicher bist, ob etwas „neu" ist: lass es weg und dokumentiere es
  stattdessen als Vorschlag.

## Stack & Architektur (so ist es — nicht ändern)
- Next.js 14 App Router, TypeScript (strict), Tailwind CSS.
- Supabase via `@supabase/ssr`. **Frontend nutzt NUR ANON-Key + Session-Cookies**
  (RLS schützt die Daten). Server Components + Server Actions in `lib/crm-actions.ts`.
- Design-Tokens (Tailwind): `ink, muted, faint, surface, elevated, border, brand,
  sky, success, warning, danger`. Keine Hardcoded-Hex-Farben außer bewusst (z.B.
  Google-Blau im Kalender).

## SICHERHEIT — hart, nicht verhandelbar
- Im Client NIEMALS Service-Role-Keys oder `NEXT_PUBLIC_*`-Secrets. Nur ANON+Session.
- Jeder Schreib-/Lösch-Pfad ist partner-scoped: `.eq("id", id).eq("partner_id", pid)`
  (Defense-in-Depth zusätzlich zu RLS). Brich diese Scopes NICHT auf.
- Recruiting-Kontext = DSGVO-sensibel. Keine personenbezogenen Daten loggen/leaken.

## Git- & Deploy-Workflow (WICHTIG)
- **Entwickle auf Branch `claude/partner-cockpit-dashboard-hdicqg`** — das ist die
  **Vercel-PRODUCTION-Branch**. `main` ist nur ein Spiegel und deployt NICHT
  (Preview ist in `vercel.json` via `git.deploymentEnabled: { "main": false }`
  deaktiviert). Halte `main` per Fast-Forward synchron, aber entwickle auf der Branch.
- **Es arbeiten mehrere Agenten auf derselben Branch.** Vor jedem Push:
  `git fetch origin <branch>` und sauber **rebasen**. NIEMALS fremde Commits
  force-überschreiben. Eigene, gerade gepushte Commits dürfen per
  `--force-with-lease` rebased werden.
- **Vercel Hobby-Limit: 100 Builds/Tag.** Sei sparsam mit Pushes (jeder Push auf
  die Production-Branch = 1 Build). KEINE leeren „trigger deployment"-Commits.
  Batche zusammengehörige Änderungen.
- KEINE Pull Requests anlegen, außer es wird ausdrücklich verlangt.
- Kein Modell-Identifier in Commits/Code/Artefakten.

## Qualitäts-Gate (PFLICHT vor JEDEM Commit/Push)
Alle drei müssen grün sein:
```
npx tsc --noEmit        # 0 Fehler
npx next lint           # 0 Warnungen/Fehler
npx next build          # „Compiled successfully", alle Seiten generiert
```
Niemals committen, wenn eines davon rot ist.

## Vorhandenes Design-System — WIEDERVERWENDEN, nicht neu bauen
- Icons: `components/ui/icons.tsx` (Inline-SVG, 24er-Grid, stroke 1.75, `flex-none`
  + `aria-hidden`). **Keine Emoji/Glyphen im Render** (kein ●, ✓, ★, → als Text) —
  immer SVG-Icons oder Token-Dots (`<span className="h-2 w-2 rounded-full bg-...">`).
- Bausteine (immer diese nutzen): `Card/CardBody/SectionHeader`, `Badge`
  (`size="sm"|"md"`, `tone`, `title`), `Table` (`TableCard/TableHead/TableBody/TableRow`,
  Spalten via `columns`-Array, sortierbar via `sortKey/onSort`), `FilterTabs`,
  `ViewToggle`, `EmptyState`, `Skeleton/TableSkeleton/RecordSkeleton`,
  `SafeBoundary` (Client-Error-Boundary), `Toaster` + `toast` aus `lib/toast.ts`,
  `RecordUnavailable` (freundlicher 404-Ersatz).
- Listen-Muster: Suchfeld + `FilterTabs` + Sort + Export (CSV via
  `lib/csv-export.ts`) + „Keine Treffer"-Zustand + Pagination („Mehr anzeigen").
- Detail-/Record-Masken: einheitliches 3-Spalten-HubSpot-Layout
  `grid xl:grid-cols-[minmax(0,20rem)_minmax(0,1fr)_minmax(0,21rem)] xl:items-start`,
  linke Identitätsspalte `xl:sticky xl:top-20`, Abschnitte in `<SafeBoundary>`.

## NICHT KAPUTT MACHEN (bekannte, bewusste Lösungen)
- `getAccounts()` paginiert über `.range()` (umgeht Supabase 1000-Zeilen-Limit) —
  NICHT durch `.limit()` ersetzen.
- Partner-Scoping auf allen Actions.
- Akzent-/ß-tolerantes `accountKey()` / `fold()` (NFKD + Diakritika + ß→ss).
- Synthetische („abgeleitete") Accounts: `ref_<base64url(name)>`-IDs,
  `isSyntheticAccountId` / `nameFromSyntheticId`. Materialisierung ändert die URL-ID
  → Redirect-Logik beachten (hat früher „Seite nicht gefunden" verursacht).
- Graceful Column-Stripping (`insertGraceful`/`updateGraceful`).
- Funktionen NICHT von Server- an Client-Components als Props übergeben
  (verursacht „Functions cannot be passed…"-Crash). Serialisierbare Props nutzen
  (z.B. `compact`-Boolean statt `renderTrigger`-Funktion bei Server→Client).

## Konkrete Arbeitsbereiche

### A) Stabilisieren
- Systematisch alle Detail-/Listenseiten und Server-Actions auf Edge-Cases prüfen:
  leere Daten, fehlende Verknüpfungen, gelöschte Datensätze, lange Strings,
  fehlende Felder. Friendly States statt Crashes (`SafeBoundary`, `RecordUnavailable`,
  `EmptyState`).
- Optimistische UI-Updates immer mit Rollback + `toast.error` bei Fehlschlag.
- Race-Conditions, doppelte Submits, fehlende `await`s aufspüren.
- Konsistente, partner-scoped Fehlerbehandlung; nie still scheitern lassen.

### B) CI aufbauen
- Lege `.github/workflows/ci.yml` an: bei Push/PR auf die Branch laufen
  `npm ci`, `tsc --noEmit`, `next lint`, `next build`. Node-Version aus dem Projekt
  (`package.json`/`.nvmrc`) übernehmen. Caching für `node_modules`/`.next`.
- Workflow muss schnell & deterministisch sein; keine Secrets nötig für den Build
  (oder Build-Time-Env als optionale Dummywerte, ohne echte Keys einzuchecken).
- Optional: ein einfaches Type-/Lint-Gate, das PRs/Commits rot markiert.

### C) Frontend weiterentwickeln (nur Politur des Vorhandenen)
- Volle Konsistenz: gleiche Paddings/Hover/Spacing über alle Listen & Karten
  (Table-Primitive überall einsetzen, wo noch Bespoke-Markup ist).
- Responsiveness: Mobile-Layouts der Tabellen/Masken/Dialoge prüfen und glätten.
- Barrierefreiheit: `aria-label`, Fokus-Ringe (`focus-visible:ring-brand`),
  Tastatur-Bedienbarkeit der Dialoge/Command-Palette, Kontrast.
- Sauberes Symbol-Rendering überall (siehe Icon-Regel), keine überlaufenden Buttons
  (Container `min-w-0`, Actions `flex-none`).
- Loading-Skeletons (`loading.tsx`) wo sinnvoll, einheitlich.

## Vorgehen pro Iteration
1. `git fetch` + rebase auf den aktuellen Branch-Stand.
2. EINEN klar abgegrenzten Verbesserungsschritt umsetzen.
3. Qualitäts-Gate (tsc + lint + build) grün machen.
4. Kleiner, klarer Commit (deutsch, `fix(...)`/`refactor(...)`/`ci(...)`/`polish(...)`).
5. Push auf die Branch, `main` per Fast-Forward nachziehen.
6. Wiederholen. Sparsam mit Pushes (Vercel-Limit).

## Definition of Done
Jede Änderung: tsc grün, lint grün, build grün, kein Funktionsverlust, alle
bekannten „Nicht-kaputt-machen"-Punkte intakt, partner-scoped & ANON-only,
einheitlich mit dem Design-System, deutsch beschriftet.

Beginne mit einer kurzen Bestandsaufnahme (Branch fetchen, Build prüfen) und liste
dann die 5 wirkungsvollsten Stabilisierungs-/Politur-Schritte, bevor du den ersten
umsetzt.
