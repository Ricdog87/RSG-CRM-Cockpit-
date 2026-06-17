# Audit: Account-Verknüpfung (Namens- vs. ID-Bezug)

**Anlass:** Der Kunde „Lagardère Travel Retail" hatte bestehende Recruiting-Mandate
(inkl. Kandidaten & Korrespondenz), war aber weder in der Kundenmaske noch in der
Suche auffindbar. Ursache war ein struktureller Bruch in der Datenlogik.

**Datum:** 2026-06-17 · **Status:** behoben + abgesichert

---

## 1. Grundursache

Im CRM referenzieren mehrere Entitäten ihren Kunden **über den Firmennamen als
Text** (`account_name` bzw. `mandate_account`), **nicht über einen Fremdschlüssel**
auf `accounts.id`:

| Entität               | Feld             | Bezug auf Account |
|-----------------------|------------------|-------------------|
| `recruiting_mandates` | `account_name`   | Name (Text)       |
| `ki_projects`         | `account_name`   | Name (Text)       |
| `opportunities`       | `account_name`   | Name (Text)       |
| `candidates`          | `mandate_account`| Name (Text)       |
| `email_activities`    | `account_id`     | FK → accounts.id  |
| `account_notes`       | `account_id`     | FK → accounts.id  |
| `crm_tasks`           | `related_id`     | FK → accounts.id  |

Daraus folgt: Ein Mandat kann auf „Lagardère Travel Retail" zeigen, **ohne dass ein
`accounts`-Datensatz mit diesem Namen existiert**. Die Kundenmaske und die Suche
lesen aber ausschließlich die Tabelle `accounts` – der Kunde war damit unsichtbar.

Account-Datensätze wurden bisher nur **bei Neuanlage** eines Projekts erzeugt
(`ensureAccount`), nicht **rückwirkend** für Altbestand/Import. Genau dieser Fall
(Mandat aus HubSpot-Import, Account nie angelegt) ließ den Kunden verschwinden.

---

## 2. Fix (mehrschichtig)

### a) Self-Healing beim Lesen (`lib/crm-data.ts → getAccounts`)
Jeder von Mandaten, KI-Projekten, Chancen oder Kandidaten **referenzierte Name**,
zu dem kein `accounts`-Datensatz existiert, wird als **virtueller Account**
ergänzt (`synthetic: true`, deterministische ID `ref:<base64url(name)>`,
Lifecycle „kunde"). Dadurch ist **jeder** Kunde sofort in Kundenmaske, Suche und
Account-Auswahlfeldern auffindbar – ohne Schreibzugriff, ohne Fehlerrisiko.

### b) Materialisierung (`lib/crm-actions.ts → backfillAccounts`)
Server-Action, die alle referenzierten Namen ohne Datensatz **idempotent** als
echte `accounts`-Zeilen anlegt (graceful gegen fehlende Spalten). Auslösbar über
den Button „Als Kunden anlegen" auf der Kundenmaske und der Account-Detailseite.
Erst als echter Datensatz können Notizen/Aufgaben/Kontakte/E-Mails (account_id-FK)
gespeichert werden.

### c) Robuste, case-insensitive Joins
- `getAccountDetail` matcht Mandate/Projekte/Chancen/Kandidaten jetzt über einen
  **normalisierten Schlüssel** (`accountKey`: trim + lowercase + Whitespace
  normalisiert) statt exaktem `===`. Außerdem löst es virtuelle IDs (`ref:…`)
  über den Namen auf.
- `ensureAccount`, `logActivity`, `backfillAccounts` und der Abgleich in
  `candidate-match` / `updateOpportunityStage` nutzen `ilike` bzw. denselben
  normalisierten Schlüssel.

### d) Bearbeiten/Löschen virtueller Accounts
- `updateAccount`: Bei `ref:`-ID wird der Account **angelegt** statt (ins Leere)
  aktualisiert.
- `deleteAccount`: Bei `ref:`-ID klare Fehlermeldung (zuerst Mandat/Projekt
  entfernen), statt stillem No-Op.

---

## 3. Audit aller gleichartigen Zusammenhänge

| Stelle | Typ | Bewertung nach Fix |
|--------|-----|--------------------|
| `getAccountDetail` (crm-data) | Join Account↔Entitäten per Name | ✅ normalisiert + virtuelle ID-Auflösung |
| `getAccounts` (crm-data) | Quelle Kundenliste/Suche | ✅ Self-Healing ergänzt fehlende |
| `suche/page.tsx` | Suche über `getAccounts` + Mandate | ✅ findet jetzt jeden Kunden |
| Topbar-Suche | leitet auf `/cockpit/suche` | ✅ profitiert automatisch |
| `ensureAccount` (Projekt-Neuanlage) | `ilike` Dublettencheck | ✅ unverändert korrekt |
| `logActivity` (Aktivität/Kaltakquise) | `ilike` + Neuanlage | ✅ korrekt |
| `updateOpportunityStage` (won_onboarding) | `eq("name")` → `ilike` | ✅ gehärtet |
| `candidate-match` Zielrolle | `eq` → `ilike` | ✅ gehärtet |
| `MandatesList/Board/ByCustomer` Kandidatenzahl | `c.mandate_account === m.account_name` | ⚠️ Anzeige-Zählung, exakt; siehe Restrisiko |
| `CandidatesView` Filter | `mandate_account === filter` | ⚠️ Anzeige-Filter aus gleichen Daten |
| `email_activities` / `account_notes` / `crm_tasks` | FK auf account_id | ✅ greifen nach Materialisierung |

---

## 4. Restrisiken & Empfehlung

- **Anzeige-Zählungen** (Kandidaten je Mandat in den Listen) vergleichen Namen
  exakt. Solange Mandat und Kandidat denselben Namen tragen (Standardfall, da aus
  derselben Auswahl erfasst), stimmt die Zahl. Bei manuell abweichender
  Schreibweise kann die Zählung abweichen – kein Datenverlust, nur Optik.
- **Strukturell sauber** wäre langfristig ein echter Fremdschlüssel
  `account_id uuid references accounts(id)` auf `recruiting_mandates`,
  `ki_projects`, `opportunities`, `candidates` mit Backfill per Name. Das
  beseitigt jede Namens-Ambiguität dauerhaft. Empfohlen als nächste Migration,
  sobald gewünscht (nicht zwingend für die Funktion).
- Der **Self-Healing-Mechanismus garantiert** ab jetzt: Kein Kunde mit Mandat,
  Projekt, Chance oder Kandidat kann mehr „unsichtbar" sein.

---

## 5. Verifikation

- `npm run build` → erfolgreich (keine Type-/ESLint-Fehler).
- „Lagardère Travel Retail" erscheint nach Deploy in Kundenmaske **und** Suche
  (zunächst als „abgeleitet"), mit verknüpften Mandaten/Kandidaten auf der
  Detailseite. Über „Als Kunden anlegen" wird er zum vollwertigen Datensatz.
