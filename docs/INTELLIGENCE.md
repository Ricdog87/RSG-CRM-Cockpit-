# RSG CRM – Intelligenz- & Automatisierungs-Layer

Überblick über die „intelligenten“ Funktionen des CRM (HubSpot-orientiert,
aus Sicht Recruiter:in + KI-Berater:in). Alle Funktionen sind **deterministisch
lauffähig** (ohne KI-Provider) und werden mit `ANTHROPIC_API_KEY` zur echten
KI-Formulierung aufgewertet.

## 1. Tages-Briefing (Dashboard)
`lib/ai/briefing.ts` + `components/cockpit/DailyBriefing.tsx`

Leitet aus echten CRM-Daten die wichtigsten Handlungssignale ab und priorisiert
sie (Severity × Dringlichkeit × Wert):
- Überfällige / heute fällige Aufgaben
- KI-Renewals & Churn-Risiko (Vertragsende ≤60 T, Health „Risiko“)
- Schließende / überfällige Verkaufschancen
- Recruiting-Mandate mit naher Deadline / dünner Kandidaten-Pipeline
- Überfällige Honorar-Rechnungen
- Kandidat:innen-Entscheidungen (Interview), neue Kandidaten zu sichten
- Inaktive Bestandskunden (≥45 T) → Reaktivierung
- Kalte Leads ohne Abschluss

Optional: KI-Coaching („KI-Briefing erstellen“) formuliert den Tag in 2–4 Sätzen.

## 2. Account-Intelligence (Kunden-Detail + Liste)
`lib/account-intel.ts`

Health-Score 0–100 pro Kunde aus Recency, Lifecycle, MRR, Churn/Health,
Renewal-Fenster, offenen Chancen, Mandatsfortschritt, Platzierungen, Vertrag.
- Detailseite: Score-Ring, Faktoren, **nächste beste Aktion**
- Kundenliste: Health-Pill + Sortierung „Risiko zuerst“ + Schnellfilter
  (Gefährdet / Beobachten / Top)

### 2b. Intelligenz-Trilogie: Empfehlung je Entität
Konsistente, deterministische Next-Best-Action mit **1-Klick-Aufgabe**:
- **Account** → `lib/account-intel.ts` (Health-Score + Aktion)
- **KI-Projekt** → `lib/ki-intel.ts` (Churn/Renewal/NPS/Upsell → Aktion)
- **Mandat** → `lib/mandate-intel.ts` (Status/Fortschritt/Deadline/Pipeline → Aktion)
- **Verkaufschance** → `lib/ai/scoring.ts` (KI-Score + nächste Aktion, je Karte)

## 3. KI-Follow-up-Writer (Kunden-Detail)
`lib/ai/followup.ts` – entwirft kontextbezogene deutsche Follow-up-Mail
(Betreff + Text, Tonalität wählbar), bearbeitbar, kopier-/mailbar.

## 4. CRM Co-Pilot (global, Topbar)
`lib/ai/copilot.ts` – beantwortet Fragen auf Basis echter Zahlen, inkl. der
priorisierten Tagessignale („Was soll ich heute zuerst tun?“, „Welche Kunden
sind gefährdet?“).

## 5. Automatisierte Workflows (HubSpot-Style)
`lib/automations.ts` + Ausführung in `lib/crm-actions.ts`. Pro Regel in
`/cockpit/automatisierungen` umschaltbar (Default: an):

| Trigger | Aktion | Kategorie |
|---|---|---|
| Neuer Lead-Account | „Erstkontakt vereinbaren“ (+2 T) | Sales |
| Chance → Gewonnen | Onboarding-Aufgabe | Sales |
| Chance → Verloren | Win-Back-Wiedervorlage (+90 T) | Sales |
| Inbound-E-Mail (Webhook) | „Auf E-Mail antworten“ | Allgemein |
| Neues Mandat | „Kandidat:innen sourcen“ (+2 T) | Recruiting |
| Neues KI-Projekt | „Kickoff-Termin vereinbaren“ (+2 T) | KI |
| Kandidat:in → Interview | „Interview-Feedback einholen“ (+2 T) | Recruiting |
| Kandidat:in → Platziert | Aftercare/NPS (+90 T) | Recruiting |
| Mandat → Besetzt | „Honorar-Rechnung stellen“ (+1 T) | Recruiting |

Gruppiert nach Kategorie auf `/cockpit/automatisierungen`, jede Regel einzeln
umschaltbar.

## 6. Outbound-Sequenzen (Kadenzen)
`lib/sequences.ts` – Multi-Step-Kadenzen als terminierte Aufgaben:
- **Kandidaten** (Recruiting): Nachfass, Talent-Reaktivierung, Nach Interview
- **Accounts** (B2B-Kaltakquise): RSG AI & RSG Recruiting (Anruf→E-Mail→
  LinkedIn→Anruf) mit Vorlagen → Enroll auf der Kunden-Detailseite

## 7. Portfolio-Insights (Berichte)
`components/cockpit/PortfolioInsights.tsx` – Konzentrationsrisiko (Top-MRR-
Anteil), MRR unter Beobachtung (Churn/Renewal), aktive Kunden vs. Leads,
Gesamt-Pipeline mit Win-Rate & Ø-Deal.

## 7b. Beziehungs-Intelligenz & Deal-Rotting
- **KI-Beziehungs-Zusammenfassung** (Kunden-Detail): fasst den Stand aus den
  letzten Notizen + E-Mails zusammen, schlägt nächsten Schritt vor.
- **Deal-Rotting**: offene Chancen mit überfälligem Abschluss werden im Sales-
  Board rot markiert.
- **Nächste beste Aktion → 1-Klick-Aufgabe** auf der Account-Intelligence-Card.

## 8. Wochen-Review (Freitag)
`lib/ai/weekly-review.ts` – an Review-/freien Tagen erscheint im Dashboard ein
Wochen-Review (Calls, E-Mails, neue Mandate/KI-Projekte, Platzierungen,
kritische Themen) mit optionaler KI-Zusammenfassung + Fokus für nächste Woche.

## 9. Datenhygiene: Dubletten-Finder
`lib/account-dedupe.ts` – erkennt wahrscheinliche Account-Dubletten (gleicher
normalisierter Name / gleiche Firmen-Domain) read-only auf der Kundenliste.

## 10. KI-ROI-Rechner (Akquise-Tool)
`components/cockpit/KiRoiCalculator.tsx` – übersetzt verpasste Anrufe in
entgangenen Umsatz und zeigt den ROI der KI-Telefonassistenz (Leads-Seite).

## 10b. Angebots-Generator (Quotes)
Druckfertige Angebote (PDF) direkt aus den Stammdaten:
- **Mandat** → `MandateProposalButton` (Festpreis/%-Modell, Zahlungsplan, AGB)
- **KI-Projekt** → `KiProposalButton` (Setup + MRR, Laufzeit, Gesamtwert)

## 11. Recruiter-Matching (vorhanden, KI-gestützt)
`lib/match.ts` – Kandidat:in ↔ Mandat-Scoring inkl. Distanz, Skills, Gehalt;
Shortlist-Panels auf Mandats- und Kandidaten-Detailseiten.

## Datenkorrektheit
`last_activity_at` wird bei jeder geloggten Aktivität/Notiz aktualisiert –
damit Health-Score & Briefing-Recency stets stimmen.

## Konfiguration
- `ANTHROPIC_API_KEY` (server-only) → KI-Formulierung (Briefing-Coaching,
  Follow-up, Co-Pilot, Lead-Intelligence, Matching-Begründung).
- Ohne Key: alle Funktionen liefern deterministische Heuristiken/Vorlagen.
