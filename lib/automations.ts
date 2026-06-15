import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { useMockData } from "@/lib/env";
import { logDataError, isMissingTable } from "@/lib/log";

export interface AutomationDef {
  key: string;
  title: string;
  description: string;
  trigger: string;
  action: string;
}

/** Definierte Workflow-Regeln (Logik in den jeweiligen Server-Aktionen). */
export const AUTOMATIONS: AutomationDef[] = [
  {
    key: "lead_followup",
    title: "Neuer Lead → Erstkontakt-Aufgabe",
    description:
      "Beim Anlegen eines Lead-Accounts wird automatisch eine Aufgabe „Erstkontakt vereinbaren“ (in 2 Tagen) erstellt.",
    trigger: "Account angelegt (Lead)",
    action: "Aufgabe erstellen",
  },
  {
    key: "won_onboarding",
    title: "Chance gewonnen → Onboarding-Aufgabe",
    description:
      "Wird eine Verkaufschance auf „Gewonnen“ gesetzt, entsteht automatisch eine Onboarding-Aufgabe beim passenden Account.",
    trigger: "Chance → Gewonnen",
    action: "Aufgabe erstellen",
  },
  {
    key: "email_reply",
    title: "E-Mail empfangen → Antwort-Aufgabe",
    description:
      "Eingehende, BCC-getrackte E-Mails erzeugen automatisch eine Aufgabe „Auf E-Mail antworten“ (heute) beim Account.",
    trigger: "Inbound-E-Mail (Webhook)",
    action: "Aufgabe erstellen",
  },
];

/** Prüft, ob eine Regel aktiv ist (Default: an). Client kann Session- oder Service-Role-Client sein. */
export async function automationEnabled(
  client: SupabaseClient,
  partnerId: string,
  key: string
): Promise<boolean> {
  try {
    const { data } = await client
      .from("automations")
      .select("enabled")
      .eq("partner_id", partnerId)
      .eq("key", key)
      .maybeSingle();
    const row = data as { enabled?: boolean } | null;
    return row ? Boolean(row.enabled) : true;
  } catch (e) {
    if (!isMissingTable(e)) logDataError("automations:enabled", e);
    return true;
  }
}

/** An/Aus-Status aller Regeln für die:den eingeloggte:n Partner:in. */
export async function getAutomationsMap(): Promise<Record<string, boolean>> {
  const defaults = Object.fromEntries(AUTOMATIONS.map((a) => [a.key, true]));
  if (useMockData) return defaults;
  try {
    const supabase = createClient();
    const { data } = await supabase.from("automations").select("key, enabled");
    const map = { ...defaults };
    for (const r of (data as Array<{ key?: string; enabled?: boolean }>) ?? []) {
      if (r.key) map[r.key] = Boolean(r.enabled);
    }
    return map;
  } catch (e) {
    if (!isMissingTable(e)) logDataError("automations:map", e);
    return defaults;
  }
}
