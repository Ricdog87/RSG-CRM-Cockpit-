import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { useMockData } from "@/lib/env";
import { logDataError, isMissingTable } from "@/lib/log";

export type AutomationCategory = "Sales & Leads" | "Recruiting" | "KI" | "Allgemein";

export interface AutomationDef {
  key: string;
  title: string;
  description: string;
  trigger: string;
  action: string;
  category?: AutomationCategory;
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
  {
    key: "mandate_sourcing",
    title: "Neues Mandat → Sourcing-Aufgabe",
    description:
      "Beim Anlegen eines Recruiting-Mandats wird automatisch eine Aufgabe „Kandidat:innen sourcen“ (in 2 Tagen) beim Kunden erstellt.",
    trigger: "Mandat angelegt",
    action: "Aufgabe erstellen",
  },
  {
    key: "ki_onboarding_kickoff",
    title: "Neues KI-Projekt → Kickoff-Aufgabe",
    description:
      "Beim Anlegen eines KI-Projekts wird automatisch eine Aufgabe „Kickoff-Termin vereinbaren“ (in 2 Tagen) beim Kunden erstellt.",
    trigger: "KI-Projekt angelegt",
    action: "Aufgabe erstellen",
  },
  {
    key: "candidate_interview_feedback",
    title: "Kandidat:in → Interview → Feedback-Aufgabe",
    description:
      "Wechselt eine:r Kandidat:in in die Interview-Phase, entsteht automatisch eine Aufgabe „Interview-Feedback einholen“ (in 2 Tagen).",
    trigger: "Kandidat:in → Interview",
    action: "Aufgabe erstellen",
  },
  {
    key: "placement_aftercare",
    title: "Platzierung → Aftercare/NPS-Aufgabe",
    description:
      "Wird eine:r Kandidat:in platziert, entsteht automatisch eine Aftercare-Aufgabe „Zufriedenheit & NPS prüfen“ (in 90 Tagen, nach Probezeit).",
    trigger: "Kandidat:in → Platziert",
    action: "Aufgabe erstellen",
  },
  {
    key: "placement_invoice",
    title: "Mandat besetzt → Rechnung-Aufgabe",
    description:
      "Wird ein Recruiting-Mandat auf „Besetzt“ gesetzt, entsteht automatisch eine Aufgabe „Honorar-Rechnung stellen“ (morgen) beim Kunden.",
    trigger: "Mandat → Besetzt",
    action: "Aufgabe erstellen",
  },
  {
    key: "lost_reengage",
    title: "Chance verloren → Wiedervorlage (90 T)",
    description:
      "Wird eine Verkaufschance auf „Verloren“ gesetzt, entsteht automatisch eine Wiedervorlage „Erneut ansprechen“ (in 90 Tagen) – nichts geht verloren.",
    trigger: "Chance → Verloren",
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
