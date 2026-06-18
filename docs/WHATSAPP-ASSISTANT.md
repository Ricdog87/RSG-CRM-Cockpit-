# CRM-Assistenz über WhatsApp (Fonio) / Telegram / Hermes

Eine **geschützte API** macht den CRM-Co-Piloten über externe Kanäle erreichbar.
Jeder Kanal (Fonio WhatsApp via n8n, Telegram, Hermes-Agent, eigene Bots) schickt
eine Nachricht an einen Endpoint und bekommt eine geerdete Antwort (echte Zahlen)
zurück. So bleibt das CRM die Quelle der Wahrheit, ohne ein Fremd-Framework in die
App zu ziehen.

## Endpoint
`POST https://<deine-domain>/api/assistant`

Header: `x-assistant-secret: <ASSISTANT_WEBHOOK_SECRET>`  (oder `?secret=` an die URL)

Body (JSON):
```json
{ "message": "Was steht heute an?", "history": [] }
```
Antwort:
```json
{ "ok": true, "reply": "Heute 3 überfällige Aufgaben …", "mode": "live" }
```

`GET /api/assistant` (mit Secret) = Health-Check.

## Benötigte Env-Variablen (Vercel · server-only)
| Variable | Zweck |
|---|---|
| `ASSISTANT_WEBHOOK_SECRET` | **Pflicht.** Starkes Zufalls-Token; schützt den Endpoint. |
| `SUPABASE_SERVICE_ROLE_KEY` | **Pflicht.** Server-Role-Lesezugriff (bereits für E-Mail-Inbound genutzt). |
| `ANTHROPIC_API_KEY` | Für KI-Antworten in natürlicher Sprache. Ohne Key → kompakte Zahlen-Zusammenfassung. |
| `ASSISTANT_OWNER_EMAIL` | Optional. Inhaber:in-Partner (z. B. `r.serrano@recruiting-sg.de`). Fallback: erste:r `is_admin`. |

> Sicherheit: Der Endpoint liest CRM-/Kundendaten. Das Secret **niemals** clientseitig
> verwenden, nur server-zu-server (n8n, Fonio-Backend, Hermes). Scope ist strikt
> auf den Inhaber-Partner begrenzt.

## Anbindung A — Fonio WhatsApp über n8n (empfohlen, da bereits vorhanden)
1. **Fonio**: WhatsApp-Assistent „Lena – RSG Recruiting" so konfigurieren, dass
   eingehende Nachrichten per Webhook an n8n gehen (Fonio → Integrationen/Webhook),
   ODER ein Tool/Function der Assistentin auf den n8n-Webhook zeigt.
2. **n8n**:
   - *Webhook*-Node (empfängt die WhatsApp-Nachricht von Fonio).
   - *HTTP Request*-Node → `POST {DOMAIN}/api/assistant`
     - Header `x-assistant-secret` = `{{ $env.ASSISTANT_WEBHOOK_SECRET }}`
     - Body: `{ "message": "{{ $json.body.text }}" }`
   - *Antwort an Fonio*: `{{ $json.reply }}` zurück an die Fonio-WhatsApp-Send-API
     (bzw. den n8n-WhatsApp/Fonio-Node) an `{{ $json.body.from }}`.

So fragst du unterwegs per WhatsApp: „Was steht heute an?", „Status Lagardère?",
„Welche Anzahlungen sind offen?", „Entwirf ein Follow-up für SKET" – und bekommst
die Antwort aus echten CRM-Daten.

## Anbindung B — Telegram (schlüsselfertig, eigener Webhook, ohne n8n)
Eigener Endpoint `/api/telegram/webhook` – sendet direkt über die Telegram-API.
1. Bot bei `@BotFather` erstellen → **Token** kopieren.
2. Vercel-Env setzen: `TELEGRAM_BOT_TOKEN`, optional `TELEGRAM_WEBHOOK_SECRET`,
   und `TELEGRAM_ALLOWED_CHAT_IDS` (Allowlist – nur diese Chats bekommen Daten).
3. Webhook registrieren (einmalig):
   `https://api.telegram.org/bot<TOKEN>/setWebhook?url=<DOMAIN>/api/telegram/webhook&secret_token=<SECRET>`
4. Dem Bot schreiben. Beim ersten Mal antwortet er mit deiner **Chat-ID** –
   diese in `TELEGRAM_ALLOWED_CHAT_IDS` eintragen (Komma-getrennt), fertig.

> Sicherheit: Ohne Allowlist gibt der Bot **keine** Daten heraus, nur die Chat-ID.

## Anbindung C — Hermes-Agent (NousResearch)
Hermes ist ein **separater, dauerlaufender Python-Dienst** (eigenes Hosting). Er wird
**nicht** in diese Next.js-App eingebaut (inkompatible Runtime + Security/DSGVO:
ein autonomer Agent mit breitem Tool-Zugriff direkt auf Kunden-PII ist riskant).
Saubere Integration stattdessen über genau diesen Endpoint:
- In Hermes ein **Tool/MCP** „rsg_crm" registrieren, das `POST {DOMAIN}/api/assistant`
  mit dem Secret aufruft. Hermes übernimmt Memory/Skills/Scheduling, das CRM bleibt
  die abgesicherte Datenquelle.
- Hermes als isolierten Container (Modal/Docker) betreiben; nur der Endpoint + Secret
  werden geteilt – kein direkter DB-Zugriff.

## Test
```bash
curl -s -X POST "$DOMAIN/api/assistant" \
  -H "x-assistant-secret: $ASSISTANT_WEBHOOK_SECRET" \
  -H "content-type: application/json" \
  -d '{"message":"Was steht heute an?"}'
```
