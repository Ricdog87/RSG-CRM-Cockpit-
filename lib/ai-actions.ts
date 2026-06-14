"use server";

import { analyzeLead } from "@/lib/ai/lead-intelligence";
import { scoreOpportunity, heuristicScore } from "@/lib/ai/scoring";
import { discoverLeads } from "@/lib/ai/discovery";
import { askCopilot } from "@/lib/ai/copilot";
import { getOpportunities } from "@/lib/crm-data";
import { createAccount, type ActionResult } from "@/lib/crm-actions";
import type {
  DiscoveryCriteria,
  DiscoveryResult,
  LeadInput,
  LeadResult,
  OppScore,
  OppScoreInput,
  ScoredOpp,
} from "@/lib/ai/types";

// Maximale Anzahl live bewerteter Chancen (begrenzt Kosten/Latenz).
const MAX_SCORED = 15;

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

/** KI-Co-Pilot: beantwortet eine Frage zum eigenen CRM. */
export async function askCopilotAction(
  question: string
): Promise<{ ok: boolean; answer?: string; mode?: "live" | "demo"; error?: string }> {
  const q = question.trim();
  if (!q) return { ok: false, error: "Bitte eine Frage eingeben." };
  try {
    const { answer, mode } = await askCopilot(q);
    return { ok: true, answer, mode };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Antwort fehlgeschlagen.",
    };
  }
}

/** Findet passende Ziel-Accounts zum Idealprofil (Lead-Discovery). */
export async function discoverLeadsAction(
  _prev: { ok: boolean; result?: DiscoveryResult; error?: string } | null,
  fd: FormData
): Promise<{ ok: boolean; result?: DiscoveryResult; error?: string }> {
  const criteria: DiscoveryCriteria = {
    branche: String(fd.get("branche") ?? "").trim() || undefined,
    region: String(fd.get("region") ?? "").trim() || undefined,
    size: String(fd.get("size") ?? "").trim() || undefined,
    focus: (String(fd.get("focus") ?? "beide") as DiscoveryCriteria["focus"]),
    notes: String(fd.get("notes") ?? "").trim() || undefined,
  };
  try {
    return { ok: true, result: await discoverLeads(criteria) };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Suche fehlgeschlagen.",
    };
  }
}

/**
 * Auto-Ausfüllen beim Anlegen: leitet aus Firmenname/Domain die übrigen
 * Account-Felder ab (Branche, Segment, Ort, Linie, Kontakt-E-Mail-Muster).
 */
export async function autofillAccountAction(
  input: Record<string, string>
): Promise<{
  ok: boolean;
  values?: Record<string, string>;
  mode?: "live" | "demo";
  error?: string;
}> {
  const company = (input.name || input.company || "").trim();
  if (!company) return { ok: false, error: "Erst einen Firmennamen eingeben." };
  const rawDomain =
    input.domain || (input.contact_email ? input.contact_email.split("@")[1] : "");
  const domain = rawDomain?.trim() || undefined;
  try {
    const { analysis, mode } = await analyzeLead({ company, domain });
    const values: Record<string, string> = {
      branche: analysis.industry,
      segment: analysis.industry,
      ort: analysis.location,
      line: analysis.recommended_line === "recruiting" ? "recruiting" : "ki",
    };
    if (domain) {
      values.contact_email = `info@${domain.replace(/^https?:\/\//, "").replace(/\/.*$/, "")}`;
    }
    return { ok: true, values, mode };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Auto-Ausfüllen fehlgeschlagen.",
    };
  }
}

/** Reichert einen bestehenden Account mit einer KI-Analyse an. */
export async function enrichAccountAction(
  input: LeadInput
): Promise<LeadActionState> {
  if (!input.company?.trim()) return { ok: false, error: "Kein Account." };
  try {
    return { ok: true, result: await analyzeLead(input) };
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

/**
 * Priorisiert die offene Pipeline: bewertet die aussichtsreichsten Chancen
 * und gibt eine nach Score sortierte „Heute zuerst"-Liste zurück.
 */
export async function prioritizePipelineAction(): Promise<{
  ok: boolean;
  items?: ScoredOpp[];
  mode?: "live" | "demo";
  error?: string;
}> {
  try {
    const opps = await getOpportunities();
    const open = opps.filter(
      (o) => o.stage !== "gewonnen" && o.stage !== "verloren"
    );
    const toInput = (o: (typeof open)[number]): OppScoreInput => ({
      account_name: o.account_name,
      line: o.line,
      title: o.title,
      value: o.value,
      value_type: o.value_type,
      stage: o.stage,
      probability: o.probability,
    });

    // Vorsortierung per Heuristik, dann nur die Top-N (ggf. live) bewerten.
    const pre = open
      .map((o) => ({ o, h: heuristicScore(toInput(o)).score }))
      .sort((a, b) => b.h - a.h)
      .slice(0, MAX_SCORED);

    const items: ScoredOpp[] = await Promise.all(
      pre.map(async ({ o }) => ({
        id: o.id,
        ...toInput(o),
        score: await scoreOpportunity(toInput(o)),
      }))
    );
    items.sort((a, b) => b.score.score - a.score.score);

    return { ok: true, items, mode: items[0]?.score.mode ?? "demo" };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Priorisierung fehlgeschlagen.",
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
