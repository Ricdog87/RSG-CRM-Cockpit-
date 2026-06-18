import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createServiceClient, hasServiceRole } from "@/lib/supabase/service";
import { aiConfigured } from "@/lib/ai/config";
import { llmComplete } from "@/lib/ai/llm";

/**
 * CRM-Assistenz für externe Kanäle (WhatsApp via Fonio/n8n, Telegram, Hermes …).
 * Läuft serverseitig mit Service-Role, strikt auf die:den Inhaber:in-Partner
 * gescoped. Antwortet geerdet auf echten CRM-Zahlen. Nie ohne geprüftes Secret
 * aufrufen (siehe /api/assistant).
 */
export interface AssistantTurn {
  role: "user" | "assistant";
  text: string;
}

const SYSTEM = `Du bist der mobile CRM-Assistent von RSG (RSG Recruiting = Personalvermittlung, RSG AI = KI-Telefonassistenz) – erreichbar über WhatsApp.
Antworte kurz, klar und auf Deutsch (WhatsApp-tauglich, wenige Sätze, ggf. Stichpunkte). Nutze die echten Zahlen aus dem Kontext. Erfinde nichts.
Bei Handlungsfragen gib eine konkrete Empfehlung. Wenn nach einem Kunden gefragt wird, fasse dessen Status zusammen. Wenn du einen Text (z. B. Follow-up) entwerfen sollst, liefere ihn direkt.`;

function eur(v: number): string {
  return new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(v || 0);
}
const str = (v: unknown) => (v == null ? "" : String(v));
const key = (s: string) => s.trim().toLowerCase().replace(/\s+/g, " ");

/** Inhaber:in-Partner auflösen (ASSISTANT_OWNER_EMAIL oder erste:r Admin). */
async function resolvePartner(sb: SupabaseClient): Promise<{ id: string; name: string } | null> {
  const email = process.env.ASSISTANT_OWNER_EMAIL?.trim();
  if (email) {
    const { data } = await sb.from("partners").select("id, full_name").ilike("email", email).maybeSingle();
    if (data) return { id: String((data as { id: string }).id), name: str((data as { full_name?: string }).full_name) || "Partner" };
  }
  const { data } = await sb.from("partners").select("id, full_name").eq("is_admin", true).limit(1).maybeSingle();
  if (data) return { id: String((data as { id: string }).id), name: str((data as { full_name?: string }).full_name) || "Partner" };
  return null;
}

type Row = Record<string, unknown>;

async function buildContext(
  sb: SupabaseClient,
  pid: string,
  message: string
): Promise<string> {
  const today = new Date().toISOString().slice(0, 10);
  const [accountsR, oppsR, kiR, mandR, candR, tasksR] = await Promise.all([
    sb.from("accounts").select("name, lifecycle, mrr, contract_status, line").eq("partner_id", pid),
    sb.from("opportunities").select("account_name, stage, value, value_type").eq("partner_id", pid),
    sb.from("ki_projects").select("account_name, status, mrr, churn_risk, contract_end").eq("partner_id", pid),
    sb.from("recruiting_mandates").select("account_name, role, status, positions, filled, deadline, fee, deposit, deposit_paid, final_paid, pricing_model").eq("partner_id", pid),
    sb.from("candidates").select("stage").eq("partner_id", pid),
    sb.from("crm_tasks").select("title, due_date, related_label").eq("partner_id", pid).eq("done", false),
  ]);
  const accounts = (accountsR.data as Row[] | null) ?? [];
  const opps = (oppsR.data as Row[] | null) ?? [];
  const ki = (kiR.data as Row[] | null) ?? [];
  const mand = (mandR.data as Row[] | null) ?? [];
  const cand = (candR.data as Row[] | null) ?? [];
  const tasks = (tasksR.data as Row[] | null) ?? [];

  const openOpps = opps.filter((o) => o.stage !== "gewonnen" && o.stage !== "verloren");
  const oppValue = openOpps.reduce((s, o) => s + Number(o.value ?? 0), 0);
  const overdue = tasks.filter((t) => t.due_date && String(t.due_date) < today);
  const dueToday = tasks.filter((t) => String(t.due_date ?? "") === today);
  const liveKi = ki.filter((p) => p.status !== "gekuendigt" && p.status !== "angebot");
  const mrr = liveKi.reduce((s, p) => s + Number(p.mrr ?? 0), 0);
  const churn = liveKi.filter((p) => p.churn_risk === "hoch").length;
  const openMand = mand.filter((m) => m.status !== "besetzt" && m.status !== "angebot");
  const offeneStellen = openMand.reduce((s, m) => s + Math.max(0, Number(m.positions ?? 0) - Number(m.filled ?? 0)), 0);
  const depositOpen = mand.filter((m) => (m.pricing_model ?? "fixed") !== "percent" && m.status !== "besetzt" && m.status !== "angebot" && Number(m.deposit ?? 0) > 0 && !m.deposit_paid);
  const restOpen = mand.filter((m) => m.status === "besetzt" && !m.final_paid);
  const interviews = cand.filter((c) => c.stage === "interview").length;

  const lines = [
    `Heute (${today}): ${overdue.length} überfällige + ${dueToday.length} heute fällige Aufgaben.`,
    overdue.slice(0, 5).map((t) => `  • ÜBERFÄLLIG: ${str(t.title)}${t.related_label ? ` (${str(t.related_label)})` : ""}`).join("\n"),
    dueToday.slice(0, 5).map((t) => `  • heute: ${str(t.title)}${t.related_label ? ` (${str(t.related_label)})` : ""}`).join("\n"),
    `Kunden: ${accounts.length} · offene Chancen: ${openOpps.length} (${eur(oppValue)}).`,
    `Recruiting: ${openMand.length} aktive Mandate, ${offeneStellen} offene Stellen, ${interviews} Kandidat:innen im Interview.`,
    depositOpen.length ? `Anzahlung offen: ${depositOpen.map((m) => str(m.account_name)).slice(0, 5).join(", ")}.` : "",
    restOpen.length ? `Restzahlung offen (besetzt): ${restOpen.map((m) => str(m.account_name)).slice(0, 5).join(", ")}.` : "",
    `KI: ${liveKi.length} aktiv, ${eur(mrr)}/M MRR${churn ? `, ${churn} mit Churn-Risiko hoch` : ""}.`,
  ].filter(Boolean);

  // Kundenbezug: erwähnte Accounts im Detail.
  const msgKey = key(message);
  const matched = accounts.filter((a) => {
    const n = key(str(a.name));
    return n.length >= 4 && msgKey.includes(n);
  }).slice(0, 2);
  for (const a of matched) {
    const nk = key(str(a.name));
    const am = mand.filter((m) => key(str(m.account_name)) === nk);
    const ak = ki.filter((p) => key(str(p.account_name)) === nk);
    lines.push(
      `\n== Kunde: ${str(a.name)} ==`,
      `Lifecycle: ${str(a.lifecycle)} · Vertrag: ${str(a.contract_status) || "—"} · Linie: ${str(a.line)}.`,
      am.length ? `Mandate: ${am.map((m) => `${str(m.role)} (${str(m.status)}, ${Number(m.filled ?? 0)}/${Number(m.positions ?? 0)})`).join("; ")}.` : "Keine Mandate.",
      ak.length ? `KI-Projekte: ${ak.map((p) => `${str(p.status)}, ${eur(Number(p.mrr ?? 0))}/M`).join("; ")}.` : ""
    );
  }

  return lines.filter(Boolean).join("\n");
}

export async function answerAssistant(
  message: string,
  history: AssistantTurn[] = []
): Promise<{ reply: string; mode: "live" | "demo" }> {
  if (!hasServiceRole()) {
    return { reply: "Assistent nicht verbunden (SUPABASE_SERVICE_ROLE_KEY fehlt).", mode: "demo" };
  }
  const sb = createServiceClient();
  const partner = await resolvePartner(sb);
  if (!partner) {
    return { reply: "Kein Inhaber-Partner gefunden (ASSISTANT_OWNER_EMAIL setzen oder is_admin pflegen).", mode: "demo" };
  }
  const context = await buildContext(sb, partner.id, message);

  if (!aiConfigured) {
    return { reply: `Aktueller Stand:\n${context}`, mode: "demo" };
  }
  const recent = history.slice(-6);
  const verlauf = recent.length
    ? "\n\nGesprächsverlauf:\n" + recent.map((m) => `${m.role === "user" ? "Frage" : "Antwort"}: ${m.text}`).join("\n")
    : "";
  const reply = await llmComplete(
    SYSTEM,
    `Kontext (echte Zahlen, Partner: ${partner.name}):\n${context}${verlauf}\n\nNachricht: ${message}`
  );
  return { reply: reply.trim() || "Dazu finde ich gerade nichts im CRM.", mode: "live" };
}
