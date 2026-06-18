import { NextResponse } from "next/server";
import { answerAssistant, type AssistantTurn } from "@/lib/ai/assistant";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Geschützte CRM-Assistenz-API für externe Kanäle (Fonio WhatsApp via n8n,
 * Telegram, Hermes …). Auth über ASSISTANT_WEBHOOK_SECRET (Header
 * `x-assistant-secret` ODER `?secret=`). Antwortet geerdet auf echten Zahlen.
 *
 * POST { message: string, history?: {role,text}[] }  → { reply, mode }
 */
function authorized(req: Request): boolean {
  const secret = process.env.ASSISTANT_WEBHOOK_SECRET ?? "";
  if (!secret) return false;
  const header = req.headers.get("x-assistant-secret") ?? "";
  const url = new URL(req.url);
  const query = url.searchParams.get("secret") ?? "";
  return header === secret || query === secret;
}

export async function GET(req: Request) {
  // Health-/Status-Check (verrät nichts ohne Secret).
  if (!authorized(req)) {
    return NextResponse.json(
      { ok: false, configured: Boolean(process.env.ASSISTANT_WEBHOOK_SECRET) },
      { status: process.env.ASSISTANT_WEBHOOK_SECRET ? 401 : 503 }
    );
  }
  return NextResponse.json({ ok: true });
}

export async function POST(req: Request) {
  if (!process.env.ASSISTANT_WEBHOOK_SECRET) {
    return NextResponse.json({ ok: false, error: "ASSISTANT_WEBHOOK_SECRET nicht gesetzt." }, { status: 503 });
  }
  if (!authorized(req)) {
    return NextResponse.json({ ok: false, error: "Nicht autorisiert." }, { status: 401 });
  }

  let body: { message?: string; text?: string; history?: AssistantTurn[] } = {};
  try {
    body = await req.json();
  } catch {
    // Fallback: form-encoded (z.B. einfache Webhooks)
    try {
      const fd = await req.formData();
      body = { message: String(fd.get("message") ?? fd.get("text") ?? "") };
    } catch {
      /* ignore */
    }
  }

  const message = (body.message ?? body.text ?? "").toString().trim();
  if (!message) {
    return NextResponse.json({ ok: false, error: "Leere Nachricht." }, { status: 400 });
  }
  const history = Array.isArray(body.history) ? body.history.slice(-6) : [];

  try {
    const { reply, mode } = await answerAssistant(message, history);
    return NextResponse.json({ ok: true, reply, mode });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "Fehler." },
      { status: 500 }
    );
  }
}
