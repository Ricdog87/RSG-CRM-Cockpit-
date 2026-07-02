# RSG CRM → Kandidaten-Datenbank (Pivot)

Branch: `feat/candidate-db-pivot` · Status: Backend Phasen 2–5 gebaut, UI + Merge offen.
**Kein Prod-Deploy ohne Freigabe.**

## Leitidee
Das RSG CRM wird reine **Kandidaten-Datenbank** mit Datenschutz-Fokus + Search-&-Match
gegen **HubSpot-Recruiting-Projekte**. Kunden/Deals/Projekte bleiben Source-of-Truth in
**HubSpot**; hier werden sie nur **read-only** referenziert.

## 1. Datenmodell (additive Migration `supabase/30_candidate_db_pivot.sql`, bereits ausgeführt)
- `candidates` **erweitert**: `linkedin_url`, `seniority`, `verfuegbar_ab`, `wechselmotivation`,
  `availability_status` (NEU|AKTIV_VERFUEGBAR|IN_VERMITTLUNG|PLATZIERT|INAKTIV|GESPERRT).
- `candidate_consents` **erweitert**: `zweck` (PROFIL_SPEICHERN|VERMITTLUNG|WEITERGABE_AN_KUNDE),
  `rechtsgrundlage`, `nachweis`, `supersedes_id` (Append-only-Audit-Kette).
- `project_refs` **(neu, read-only HubSpot-Spiegel)**: `hubspot_deal_id`, titel, kunde,
  anforderungen, skills[], standort, status, pipeline/stage, `raw` (jsonb), `last_synced_at`.
- `matches` **(neu)**: Kandidat ↔ `project_ref`, `score`, `match_gruende` (jsonb),
  Status (VORGESCHLAGEN…PLATZIERT), `vorgestellt_am`.
- RLS für `project_refs`/`matches` partner-scoped (wie Bestand). Bestandsdaten unangetastet.

## 2. DSGVO-Funktionen (Phase 3)
- **Consent-Gate** `lib/dsgvo/consent.ts`: `assertCanPresent(candidateId)` blockiert jede
  Vorstellung/Weitergabe ohne gültige `VERMITTLUNG`/`WEITERGABE_AN_KUNDE`-Einwilligung.
  `consentStateFor()` (ERTEILT|WIDERRUFEN|ABGELAUFEN|KEINE), `candidateConsentSummary()`.
  Bestandsdaten ohne `zweck` zählen nur als Profil-Einwilligung.
- **Betroffenenrechte** `lib/dsgvo/subject-rights.ts`:
  - `exportCandidateData()` – Art. 15 Auskunft (alle gespeicherten Daten).
  - `eraseCandidate(mode)` – Art. 17: `anonymize` (PII überschreiben, Status GESPERRT,
    Matches/Vorstellungen entfernt) oder `delete` (harte, kaskadierende Löschung).
    `activity_log` bleibt erhalten (nicht-personenbezogen).
- **Erzwingung** in der Business-Logik: `lib/matches-actions.ts` ruft das Consent-Gate
  bei `proposeMatch()` und bei jedem Status-Wechsel auf eine präsentierende Stufe.

## 3. Search & Match (Phase 4)
- `lib/candidate-project-match.ts` → `rankCandidatesForProject(projectRefId)`:
  Skill-Overlap (akzent-tolerant, max 60) + Standort (20) + Verfügbarkeit/Status (20).
  Liefert Score + Begründung; Consent-Gate setzt das `vorstellbar`-Flag pro Treffer.
- `lib/project-refs-data.ts`: read-only Zugriff auf die gespiegelten Projekte.
- **Offen:** UI-Seite „Projekt wählen → gerankte Kandidaten" + „Vorschlagen"-Aktion.

## 4. HubSpot read-only Sync (Phase 5)
- `lib/hubspot/sync.ts` → `syncHubspotProjects()`: liest offene Recruiting-Deals
  (Read-Scopes) und upsertet sie in `project_refs`. **Einseitig** – kein Schreiben nach
  HubSpot, keine Kandidaten-Pushes. Property-Namen via ENV konfigurierbar.
- Trigger: `POST /api/hubspot/sync-projects` (Partner-Session). Cron/n8n später:
  später mit dediziertem Secret-Header absichern und z.B. stündlich aufrufen.

### Benötigte ENV
| Variable | Pflicht | Zweck |
|---|---|---|
| `HUBSPOT_PRIVATE_APP_TOKEN` | ✅ | Private-App-Token (Read) |
| `HUBSPOT_RECRUITING_PIPELINE` | optional | nur diese Pipeline syncen |
| `HUBSPOT_PROP_STANDORT` / `_ANFORDERUNGEN` / `_SKILLS` / `_KUNDE` | optional | Custom-Property-Namen eures Deal-Schemas |
| `SYNC_CRON_SECRET` | optional | aktiviert den Cron/n8n-Pfad (Header `x-sync-secret`) |
| `HUBSPOT_PORTAL_ID` | optional | aktiviert „In HubSpot öffnen"-Deeplinks zu den Deals (euer Portal laut Deal-URLs: `147306094`) |

### Cron/n8n-Trigger
`SYNC_CRON_SECRET` setzen, dann z.B. stündlich:
`POST /api/hubspot/sync-projects` mit Header `x-sync-secret: <SYNC_CRON_SECRET>`
→ Sync für alle Partner via Service-Role (ohne Login). Ohne Secret-Header läuft
der Sync über die Partner-Session (Cockpit-Button).

### HubSpot Private App – Read-Scopes
`crm.objects.deals.read`, `crm.schemas.deals.read`
(optional: `crm.objects.companies.read`, `crm.objects.contacts.read`)

### HubSpot-Schema (inspiziert) → empfohlene Config
- Pipeline `default` = **„Recruiting-Pipeline"** → **`HUBSPOT_RECRUITING_PIPELINE=default`**
  (Pipeline `3535347914` „KI Projekte" bleibt außen vor). Closed-Stages
  „Placement"/„Nicht besetzt" werden von `isOpen()` ausgefiltert.
- **Achtung:** Die Deals haben KEINE strukturierten Properties für Skills/Standort –
  alles steckt im `dealname` (z.B. „Asklepios- Standortleiter (m/w/d) Wiesbaden").
  Das Ranking matcht daher gegen den Projekttext (Deal-Name/`description`).
  Für besseres Matching empfohlen: eigene Deal-Properties „Skills" und „Standort"
  in HubSpot anlegen und als `HUBSPOT_PROP_SKILLS` / `HUBSPOT_PROP_STANDORT` setzen
  (+ `HUBSPOT_PROP_ANFORDERUNGEN=description`, falls genutzt).

## 5. Navigation (D1)
Kunden/Deals/Projekte aus dem Menü ausgeblendet (`lib/nav.ts`); Fokus „Kandidaten +
Einwilligungen". Seiten/Daten bleiben per URL erreichbar – **nichts gelöscht**.

## Was DU tun musst
1. **HubSpot Private App** anlegen (Scopes oben) → Token als `HUBSPOT_PRIVATE_APP_TOKEN`
   in Vercel (Environment Variables) hinterlegen. Optional die `HUBSPOT_PROP_*`-Namen.
2. **Branch reviewen** `feat/candidate-db-pivot` und freigeben, bevor sie nach Production
   (Branch `claude/partner-cockpit-dashboard-hdicqg`) gemerged/deployt wird.
3. **RLS-Leck schließen** (separat, dringend): 6 PascalCase-Tabellen
   (`PartnerPasswordResetToken`, `PartnerAuditLog`, `PartnerAccount`, `PartnerTier`,
   `PartnerPricing`, `PartnerCustomer`) haben RLS deaktiviert → über Anon-Key voll
   exponiert. RLS aktivieren **nur mit passenden Policies** (sonst Total-Sperre).

## Erledigt (komplett nutzbar)
- ✅ Search-&-Match-**UI** (`/cockpit/match`): Projekt wählen → gerankte Kandidaten + „Vorschlagen".
- ✅ Consent-**Zweck-Überblick** + Betroffenenrechte (Art. 15/17) im Kandidatenprofil.
- ✅ Append-only-Consent-Schreiblogik + zweck-bewusste Anfrage (Default VERMITTLUNG).
- ✅ Kandidaten-DB-Felder editierbar (`availability_status`, Seniorität, LinkedIn, …).
- ✅ Cron/n8n-Trigger des Sync mit Secret-Header (`SYNC_CRON_SECRET`).

## Noch offen (optional, nach Go-Live)
- „Projekte (HubSpot)"-Read-only-Listenansicht als eigene Seite.
- Feinere Match-Gewichtung / Seniority-Berücksichtigung.
