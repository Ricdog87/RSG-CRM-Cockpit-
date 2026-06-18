# RSG CRM – Setup & Aktivierung

Alles an einem Ort: Migrationen (Supabase) + Env-Variablen (Vercel), um alle
Funktionen scharf zu schalten. Alle Migrationen sind additiv & idempotent.

## 1. Supabase-Migrationen (SQL-Editor → Inhalt der Datei einfügen → Run)
Reihenfolge spielt keine Rolle (idempotent). Mindestens die letzten ausführen:

| Datei | Zweck |
|---|---|
| `supabase/26_mandate_payments.sql` | Anzahlung/Restzahlung-Gate (Festpreis) |
| `supabase/27_persistence_fix.sql` | Adresse + Kandidaten-Recruiterfelder |
| `supabase/28_ensure_all_columns.sql` | **Alle** Spalten – endgültige Persistenz-Absicherung |
| `supabase/29_fonio_calls.sql` | KI-Anruf-Historie (Fonio) |

> Nach `28` kann kein Eingabefeld mehr still verworfen werden.

## 2. Env-Variablen (Vercel · Project Settings → Environment Variables)
Alle server-only (kein `NEXT_PUBLIC`). Fehlt eine, degradiert das Feature sauber.

### Basis (bereits gesetzt)
- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` (Webhooks/Assistent)
- `ANTHROPIC_API_KEY` (KI-Texte, Co-Pilot, Assistent)

### KI-Telefonassistenz (Fonio Outbound-Call)
- `FONIO_API_KEY`, `FONIO_FROM_NUMBER` (Absendernummer/Assistant)

### Mobiler Assistent – generische API (`/api/assistant`)
- `ASSISTANT_WEBHOOK_SECRET` (Pflicht), `ASSISTANT_OWNER_EMAIL` (z. B. r.serrano@recruiting-sg.de)

### Mobiler Assistent – Telegram (schlüsselfertig)
- `TELEGRAM_BOT_TOKEN` (von @BotFather)
- `TELEGRAM_ALLOWED_CHAT_IDS` (Komma-getrennt – nur diese Chats bekommen Daten)
- `TELEGRAM_WEBHOOK_SECRET` (optional), `CRON_SECRET` (für Morgen-Push)

Webhook registrieren (einmalig):
```
https://api.telegram.org/bot<TOKEN>/setWebhook?url=https://<DOMAIN>/api/telegram/webhook&secret_token=<TELEGRAM_WEBHOOK_SECRET>
```
Dem Bot schreiben → er nennt deine Chat-ID → in `TELEGRAM_ALLOWED_CHAT_IDS` eintragen.

## 3. Automatisierungen (Cron)
`vercel.json` enthält einen täglichen Cron `05:00 UTC` → `/api/telegram/digest`
(proaktives Morgen-Briefing). Greift, sobald Telegram-Env + `CRON_SECRET` gesetzt.

## 4. WhatsApp (Fonio) – Messaging
Siehe `docs/WHATSAPP-ASSISTANT.md` (Anbindung via n8n/Fonio an `/api/assistant`).
Für echtes 1:1-Messaging mit Kandidaten/Kunden: Masterprompt an Cowork (separate
Tabelle `wa_messages`, Inbound-Webhook, Outbound-Action).

## Schnelltest Assistent
```bash
curl -s -X POST "https://<DOMAIN>/api/assistant" \
  -H "x-assistant-secret: $ASSISTANT_WEBHOOK_SECRET" \
  -H "content-type: application/json" \
  -d '{"message":"Was steht heute an?"}'
```
