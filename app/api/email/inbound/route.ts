import { NextResponse, type NextRequest } from "next/server";
import { createServiceClient, hasServiceRole } from "@/lib/supabase/service";
import { emailDomain, isGenericDomain } from "@/lib/dedupe";
import { automationEnabled } from "@/lib/automations";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Inbound-E-Mail-Webhook (provider-agnostisch). Empfängt BCC-getrackte Mails
 * von einem Inbound-Mail-Dienst (SendGrid Inbound Parse / Mailgun Routes /
 * Postmark Inbound …) – als JSON oder Form-Data. Ordnet die Mail dem passenden
 * Account zu (intelligenter Abgleich über E-Mail/Domain) und speichert sie via
 * Service-Role in email_activities. Dubletten über (partner_id, message_id).
 *
 * BCC-Adresse: track+<token>@<EMAIL_INBOUND_DOMAIN>. Der Token identifiziert
 * die:den Partner:in. Optionaler Schutz: Header x-webhook-secret == EMAIL_WEBHOOK_SECRET.
 */

function json(body: unknown, status = 200) {
  return NextResponse.json(body, { status });
}

async function readPayload(req: NextRequest): Promise<Record<string, string>> {
  const ct = req.headers.get("content-type") || "";
  const out: Record<string, string> = {};
  try {
    if (ct.includes("application/json")) {
      const j = (await req.json()) as Record<string, unknown>;
      for (const [k, v] of Object.entries(j)) {
        out[k.toLowerCase()] = typeof v === "string" ? v : JSON.stringify(v);
      }
    } else {
      const fd = await req.formData();
      for (const [k, v] of fd.entries()) {
        out[k.toLowerCase()] = typeof v === "string" ? v : "";
      }
    }
  } catch {
    /* leerer Payload */
  }
  return out;
}

function pick(d: Record<string, string>, ...keys: string[]): string {
  for (const k of keys) if (d[k]) return d[k];
  return "";
}

function parseEmail(s: string): string {
  const m = s.match(/<([^>]+)>/);
  if (m) return m[1].trim().toLowerCase();
  const m2 = s.match(/[^\s,;<>"']+@[^\s,;<>"']+/);
  return m2 ? m2[0].toLowerCase() : "";
}

function parseName(s: string): string {
  const m = s.match(/^\s*"?([^"<]+?)"?\s*</);
  return m ? m[1].trim() : "";
}

interface AccountRow {
  id: string;
  name?: string | null;
  contact_email?: string | null;
}

function matchAccount(
  accounts: AccountRow[],
  fromEmail: string,
  toEmail: string
): { id: string; direction: "inbound" | "outbound" } | null {
  const fd = emailDomain(fromEmail);
  const td = emailDomain(toEmail);
  for (const a of accounts) {
    const ae = String(a.contact_email ?? "").toLowerCase();
    if (ae && ae === fromEmail) return { id: a.id, direction: "inbound" };
    if (ae && ae === toEmail) return { id: a.id, direction: "outbound" };
    const ad = emailDomain(ae);
    if (ad && !isGenericDomain(ad)) {
      if (ad === fd) return { id: a.id, direction: "inbound" };
      if (ad === td) return { id: a.id, direction: "outbound" };
    }
  }
  // Kein Account-Treffer: anhand der Domain-Generizität Richtung schätzen.
  if (fd && !isGenericDomain(fd)) return null;
  return null;
}

export async function POST(req: NextRequest) {
  const secret = process.env.EMAIL_WEBHOOK_SECRET;
  if (secret && req.headers.get("x-webhook-secret") !== secret) {
    return json({ ok: false, error: "unauthorized" }, 401);
  }

  const d = await readPayload(req);

  // Empfänger-Felder nach track+<token>@ durchsuchen.
  const recipients = [
    d.to,
    d.recipient,
    d.cc,
    d.bcc,
    d.envelope,
    d.tofull,
    d.bccfull,
    d.headers,
  ]
    .filter(Boolean)
    .join(" ");
  const tokenMatch = recipients.match(/track\+([a-z0-9]+)@/i);
  const token = d.token || (tokenMatch ? tokenMatch[1] : "");

  const fromRaw = pick(d, "from", "sender", "fromfull");
  const fromEmail = parseEmail(fromRaw);
  const fromName = parseName(fromRaw) || pick(d, "fromname");
  const toEmail = parseEmail(pick(d, "to", "recipient", "tofull"));
  const subject = pick(d, "subject");
  const body = pick(d, "text", "body-plain", "textbody", "stripped-text", "html");
  const messageId = pick(d, "message-id", "messageid", "message_id");

  if (!hasServiceRole()) {
    return json({ ok: true, demo: true, note: "Kein Service-Role-Key gesetzt – nicht gespeichert." });
  }
  if (!token) return json({ ok: false, error: "Kein Tracking-Token in der Adresse." });

  const svc = createServiceClient();

  const { data: inbox } = await svc
    .from("partner_inbox")
    .select("partner_id")
    .eq("token", token)
    .maybeSingle();
  if (!inbox) return json({ ok: false, error: "Token unbekannt." });
  const partnerId = (inbox as { partner_id: string }).partner_id;

  const { data: accounts } = await svc
    .from("accounts")
    .select("id, name, contact_email")
    .eq("partner_id", partnerId);
  const match = matchAccount(
    (accounts as AccountRow[]) ?? [],
    fromEmail,
    toEmail
  );

  const { error } = await svc.from("email_activities").insert({
    partner_id: partnerId,
    account_id: match?.id ?? null,
    message_id: messageId || null,
    direction: match?.direction ?? "outbound",
    from_email: fromEmail,
    from_name: fromName,
    to_email: toEmail,
    subject,
    snippet: body.slice(0, 280),
    body,
    occurred_at: new Date().toISOString(),
  });

  if (error && !/duplicate key|unique/i.test(error.message)) {
    return json({ ok: false, error: error.message });
  }

  // Workflow: eingehende E-Mail → Antwort-Aufgabe beim Account.
  if (
    match &&
    match.direction === "inbound" &&
    (await automationEnabled(svc, partnerId, "email_reply"))
  ) {
    const accName =
      ((accounts as AccountRow[]) ?? []).find((a) => a.id === match.id)?.name ?? null;
    await svc.from("crm_tasks").insert({
      partner_id: partnerId,
      related_type: "customer",
      related_id: match.id,
      related_label: accName,
      title: "Auf E-Mail antworten",
      due_date: new Date().toISOString().slice(0, 10),
    });
  }

  return json({ ok: true, account_id: match?.id ?? null, matched: !!match });
}
