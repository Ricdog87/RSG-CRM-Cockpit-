import { NextResponse } from "next/server";
import { answerAssistant } from "@/lib/ai/assistant";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Telegram-Bot-Webhook → CRM-Assistent (komplett eigenständig, ohne Fonio).
 * Sicherheit:
 *  - Optionaler Webhook-Secret-Header (TELEGRAM_WEBHOOK_SECRET).
 *  - STRIKTE Allowlist: nur Chat-IDs aus TELEGRAM_ALLOWED_CHAT_IDS dürfen
 *    Antworten mit echten CRM-Daten erhalten. Ohne Allowlist wird nur die
 *    eigene Chat-ID zurückgemeldet (zum Eintragen) – niemals Daten.
 *
 * Setup: BotFather-Token → TELEGRAM_BOT_TOKEN; Webhook setzen mit
 *   https://api.telegram.org/bot<TOKEN>/setWebhook?url=<DOMAIN>/api/telegram/webhook&secret_token=<SECRET>
 */
async function sendMessage(chatId: number | string, text: string) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return;
  await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text, disable_web_page_preview: true }),
  }).catch(() => {});
}

export async function POST(req: Request) {
  if (!process.env.TELEGRAM_BOT_TOKEN) {
    return NextResponse.json({ ok: false, error: "TELEGRAM_BOT_TOKEN fehlt." }, { status: 503 });
  }
  // Optionaler Secret-Header (von Telegram bei setWebhook secret_token gesetzt).
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
  if (secret && req.headers.get("x-telegram-bot-api-secret-token") !== secret) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  let update: { message?: { chat?: { id?: number }; text?: string } } = {};
  try {
    update = await req.json();
  } catch {
    return NextResponse.json({ ok: true });
  }
  const chatId = update.message?.chat?.id;
  const text = (update.message?.text ?? "").trim();
  if (!chatId) return NextResponse.json({ ok: true });

  // Allowlist prüfen (Daten nur für autorisierte Chats).
  const allowed = (process.env.TELEGRAM_ALLOWED_CHAT_IDS ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (allowed.length === 0 || !allowed.includes(String(chatId))) {
    await sendMessage(
      chatId,
      `Nicht autorisiert. Deine Chat-ID ist: ${chatId}\nTrage sie in TELEGRAM_ALLOWED_CHAT_IDS ein, um den CRM-Assistenten zu nutzen.`
    );
    return NextResponse.json({ ok: true });
  }

  if (!text) {
    await sendMessage(chatId, "Schick mir eine Frage zum CRM – z. B. „Was steht heute an?“ oder „Status Lagardère?“.");
    return NextResponse.json({ ok: true });
  }

  try {
    const { reply } = await answerAssistant(text);
    await sendMessage(chatId, reply.slice(0, 3900));
  } catch (e) {
    await sendMessage(chatId, `Fehler: ${e instanceof Error ? e.message : "unbekannt"}`);
  }
  return NextResponse.json({ ok: true });
}

export async function GET() {
  return NextResponse.json({ ok: true, configured: Boolean(process.env.TELEGRAM_BOT_TOKEN) });
}
