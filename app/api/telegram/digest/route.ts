import { NextResponse } from "next/server";
import { answerAssistant } from "@/lib/ai/assistant";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Proaktiver Morgen-Push: sendet das Tages-Briefing an alle autorisierten
 * Telegram-Chats. Wird per Vercel Cron (siehe vercel.json) oder manuell mit
 * Secret aufgerufen. Auth: Vercel-Cron `Authorization: Bearer <CRON_SECRET>`
 * ODER `?secret=<CRON_SECRET|ASSISTANT_WEBHOOK_SECRET>`.
 */
async function sendMessage(token: string, chatId: string, text: string) {
  await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text, disable_web_page_preview: true }),
  }).catch(() => {});
}

function authorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET || process.env.ASSISTANT_WEBHOOK_SECRET || "";
  if (!secret) return false;
  const auth = req.headers.get("authorization") ?? "";
  const url = new URL(req.url);
  const q = url.searchParams.get("secret") ?? "";
  return auth === `Bearer ${secret}` || q === secret;
}

export async function GET(req: Request) {
  if (!authorized(req)) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chats = (process.env.TELEGRAM_ALLOWED_CHAT_IDS ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (!token || chats.length === 0) {
    return NextResponse.json({ ok: false, error: "TELEGRAM_BOT_TOKEN / TELEGRAM_ALLOWED_CHAT_IDS fehlen." }, { status: 503 });
  }

  // Wochenende überspringen (Sa/So) – außer mit ?force=1.
  const day = new Date().getDay();
  const force = new URL(req.url).searchParams.get("force") === "1";
  if (!force && (day === 0 || day === 6)) {
    return NextResponse.json({ ok: true, skipped: "weekend" });
  }

  const { reply } = await answerAssistant(
    "Erstelle mein kurzes Morgen-Briefing: überfällige & heute fällige Aufgaben, gefährdete Kunden/Zahlungen, und der wichtigste Fokus für heute. Maximal 6 Zeilen, motivierend."
  );
  const text = `☀️ Guten Morgen! Dein RSG-Briefing:\n\n${reply}`.slice(0, 3900);
  for (const chat of chats) await sendMessage(token, chat, text);
  return NextResponse.json({ ok: true, sent: chats.length });
}
