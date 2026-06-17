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

| Trigger | Aktion |
|---|---|
| Neuer Lead-Account | Aufgabe „Erstkontakt vereinbaren“ (+2 T) |
| Chance → Gewonnen | Onboarding-Aufgabe beim Account |
| Inbound-E-Mail (Webhook) | Aufgabe „Auf E-Mail antworten“ |
| **Neues Mandat** | Aufgabe „Kandidat:innen sourcen“ (+2 T) |
| **Neues KI-Projekt** | Aufgabe „Kickoff-Termin vereinbaren“ (+2 T) |
| **Kandidat:in → Interview** | Aufgabe „Interview-Feedback einholen“ (+2 T) |
| **Kandidat:in → Platziert** | Aftercare/NPS-Aufgabe (+90 T) |

## 6. Outbound-Sequenzen (Kadenzen)
`lib/sequences.ts` – Multi-Step-Kadenzen als terminierte Aufgaben:
- **Kandidaten** (Recruiting): Nachfass, Talent-Reaktivierung, Nach Interview
- **Accounts** (B2B-Kaltakquise): RSG AI & RSG Recruiting (Anruf→E-Mail→
  LinkedIn→Anruf) mit Vorlagen → Enroll auf der Kunden-Detailseite

## 7. Portfolio-Insights (Berichte)
`components/cockpit/PortfolioInsights.tsx` – Konzentrationsrisiko (Top-MRR-
Anteil), MRR unter Beobachtung (Churn/Renewal), aktive Kunden vs. Leads,
Gesamt-Pipeline mit Win-Rate & Ø-Deal.

## 8. Recruiter-Matching (vorhanden, KI-gestützt)
`lib/match.ts` – Kandidat:in ↔ Mandat-Scoring inkl. Distanz, Skills, Gehalt;
Shortlist-Panels auf Mandats- und Kandidaten-Detailseiten.

## Datenkorrektheit
`last_activity_at` wird bei jeder geloggten Aktivität/Notiz aktualisiert –
damit Health-Score & Briefing-Recency stets stimmen.

## Konfiguration
- `ANTHROPIC_API_KEY` (server-only) → KI-Formulierung (Briefing-Coaching,
  Follow-up, Co-Pilot, Lead-Intelligence, Matching-Begründung).
- Ohne Key: alle Funktionen liefern deterministische Heuristiken/Vorlagen.
