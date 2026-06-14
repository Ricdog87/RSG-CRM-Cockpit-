"use server";

import { analyzeLead } from "@/lib/ai/lead-intelligence";
import { scoreOpportunity } from "@/lib/ai/scoring";
import { createAccount, type ActionResult } from "@/lib/crm-actions";
import type { LeadResult, OppScore, OppScoreInput } from "@/lib/ai/types";

export type LeadActionState = {
  ok: boolean;
  result?: LeadResult;
  error?: string;
};

/** Führt die KI-Lead-Analyse aus (Server Action für das Formular). */
export async function runLeadAnalysis(
  _prev: LeadActionState | null,
  fd: FormData
): Promise<LeadActionState> {
  const company = String(fd.get("company") ?? "").trim();
  if (!company) return { ok: false, error: "Firmenname ist erforderlich." };

  try {
    const result = await analyzeLead({
      company,
      domain: String(fd.get("domain") ?? "").trim() || undefined,
      notes: String(fd.get("notes") ?? "").trim() || undefined,
    });
    return { ok: true, result };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Analyse fehlgeschlagen.",
    };
  }
}

/** Bewertet eine Verkaufschance (KI-Score + nächste beste Aktion). */
export async function scoreOpportunityAction(
  input: OppScoreInput
): Promise<{ ok: boolean; score?: OppScore; error?: string }> {
  try {
    const score = await scoreOpportunity(input);
    return { ok: true, score };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Bewertung fehlgeschlagen.",
    };
  }
}

/** Übernimmt einen analysierten Lead als CRM-Account. */
export async function importLeadAsAccount(fd: FormData): Promise<ActionResult> {
  // line aus recommended_line ableiten (beide/keine → ki als Default)
  const rec = String(fd.get("recommended_line") ?? "ki");
  fd.set("line", rec === "recruiting" ? "recruiting" : "ki");
  fd.set("lifecycle", "lead");
  return createAccount(null, fd);
}
