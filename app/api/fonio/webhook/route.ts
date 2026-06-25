import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { processFonioCallResult } from "@/lib/fonio-webhook";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Fonio Eingangs-Webhook: wird von Fonio nach Anruf-Ende aufgerufen.
 * POST /api/fonio/webhook  (Header `x-fonio-secret: <FONIO_WEBHOOK_SECRET>`
 * oder ?secret=…) → speichert Ergebnis + legt Auto-Notiz beim Kandidaten an.
 *
 * Ohne gesetztes FONIO_WEBHOOK_SECRET ist der Webhook deaktiviert (401).
 */
export async function POST(req: Request) {
  const secret = process.env.FONIO_WEBHOOK_SECRET;
  const provided = headers().get("x-fonio-secret") ?? new URL(req.url).searchParams.get("secret");
  if (!secret || provided !== secret) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  let payload: Record<string, unknown> = {};
  try {
    payload = (await req.json()) as Record<string, unknown>;
  } catch {
    /* leerer/ungültiger Body → defensiv weiter */
  }

  const result = await processFonioCallResult(payload);
  return NextResponse.json(result, {
    status: result.ok ? 200 : 400,
    headers: { "Cache-Control": "no-store" },
  });
}
