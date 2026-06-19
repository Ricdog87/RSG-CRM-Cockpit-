"use server";

import { analyzeLead } from "@/lib/ai/lead-intelligence";
import { scoreOpportunity, heuristicScore } from "@/lib/ai/scoring";
import { discoverLeads } from "@/lib/ai/discovery";
import { askCopilot } from "@/lib/ai/copilot";
import { buildBriefing } from "@/lib/ai/briefing";
import { narrateBriefing } from "@/lib/ai/briefing-narrate";
import { draftFollowup, type FollowupDraft } from "@/lib/ai/followup";
import { narrateWeeklyReview, type WeeklyReviewInput } from "@/lib/ai/weekly-review";
import { summarizeRelationship, type RelationshipInput } from "@/lib/ai/account-summary";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { useMockData } from "@/lib/env";
import { logDataError } from "@/lib/log";
import { enrichCompanyFromWebsite } from "@/lib/ai/company-enrich";
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
  question: string,
  history: { role: "user" | "assistant"; text: string }[] = []
): Promise<{ ok: boolean; answer?: string; mode?: "live" | "demo"; error?: string }> {
  const q = question.trim();
  if (!q) return { ok: false, error: "Bitte eine Frage eingeben." };
  try {
    const { answer, mode } = await askCopilot(q, history);
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

/**
 * KI-Tages-Briefing: formuliert aus den (deterministisch berechneten) Signalen
 * ein kurzes, motivierendes Coaching. Wird on-demand vom Dashboard aufgerufen.
 */
export async function narrateBriefingAction(): Promise<{
  ok: boolean;
  text?: string;
  mode?: "live" | "demo";
  error?: string;
}> {
  try {
    const b = await buildBriefing();
    const { text, mode } = await narrateBriefing(b);
    return { ok: true, text, mode };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Briefing fehlgeschlagen.",
    };
  }
}

/** KI: formuliert ein Wochen-Review (Freitag) aus übergebenen Zahlen. */
export async function narrateWeeklyReviewAction(
  input: WeeklyReviewInput
): Promise<{ ok: boolean; text?: string; mode?: "live" | "demo"; error?: string }> {
  try {
    const { text, mode } = await narrateWeeklyReview(input);
    return { ok: true, text, mode };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Review fehlgeschlagen." };
  }
}

/** KI: fasst den Beziehungsstand eines Kunden aus Notizen/E-Mails zusammen. */
export async function summarizeAccountAction(
  input: RelationshipInput
): Promise<{ ok: boolean; summary?: string; mode?: "live" | "demo"; error?: string }> {
  try {
    const { summary, mode } = await summarizeRelationship(input);
    return { ok: true, summary, mode };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Zusammenfassung fehlgeschlagen." };
  }
}

/** KI: entwirft eine Follow-up-E-Mail für einen Kunden. */
export async function draftFollowupAction(input: {
  account: string;
  line: "ki" | "recruiting";
  context: string;
  tone?: "freundlich" | "direkt" | "beratend";
  goal?: string;
  sender?: string;
}): Promise<{ ok: boolean; draft?: FollowupDraft; error?: string }> {
  if (!input.account?.trim()) return { ok: false, error: "Kein Kunde." };
  try {
    return { ok: true, draft: await draftFollowup(input) };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Entwurf fehlgeschlagen." };
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

// ---------- Website-Anreicherung (öffentliches Firmenprofil) ----------

async function currentPartnerId(): Promise<{ id: string | null; error?: string }> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { id: null, error: "Keine aktive Session." };
  const { data, error } = await supabase
    .from("partners")
    .select("id")
    .eq("auth_user_id", user.id)
    .single();
  if (error || !data) return { id: null, error: "Kein Partner-Profil gefunden." };
  return { id: data.id as string };
}

export type WebsiteEnrichResult = {
  ok: boolean;
  error?: string;
  demo?: boolean;
  /** Felder, die tatsächlich (weil zuvor leer) befüllt wurden. */
  filled?: Partial<Record<"branche" | "segment" | "ort" | "country", string>>;
  /** Firmenbeschreibung von der Website (als Notiz gespeichert). */
  beschreibung?: string;
};

/**
 * Reichert einen bestehenden Account aus seiner Website an: Claude liest die
 * Startseite (serverseitig geladen) und extrahiert ein öffentliches Profil.
 * Es werden NUR leere Account-Felder (branche/segment/ort/country) befüllt; die
 * Beschreibung wird als Notiz hinterlegt. Partner-scoped (Session-Client, RLS +
 * zusätzlicher partner_id-Filter). Robuste Fehlerbehandlung.
 */
export async function enrichAccountFromWebsiteAction(
  accountId: string
): Promise<WebsiteEnrichResult> {
  if (!accountId) return { ok: false, error: "Kein Account." };
  if (useMockData) return { ok: true, demo: true };
  try {
    const { id: pid, error: pidErr } = await currentPartnerId();
    if (!pid) return { ok: false, error: pidErr };
    const supabase = createClient();

    // Account partner-scoped laden (RLS + expliziter partner_id-Filter).
    const { data: acc, error: accErr } = await supabase
      .from("accounts")
      .select("id, domain, branche, segment, ort, country")
      .eq("id", accountId)
      .eq("partner_id", pid)
      .maybeSingle();
    if (accErr) return { ok: false, error: accErr.message };
    if (!acc) return { ok: false, error: "Account nicht gefunden." };

    const domain = String((acc as Record<string, unknown>).domain ?? "").trim();
    if (!domain) {
      return { ok: false, error: "Keine Domain hinterlegt – im Bearbeiten-Dialog ergänzen." };
    }

    const profile = await enrichCompanyFromWebsite(domain);

    // Nur LEERE Felder befüllen (vorhandene Daten nie überschreiben).
    const isEmpty = (v: unknown) => v == null || String(v).trim() === "";
    const patch: Record<string, string> = {};
    const filled: WebsiteEnrichResult["filled"] = {};
    const consider = (
      key: "branche" | "segment" | "ort" | "country",
      value?: string
    ) => {
      if (value && isEmpty((acc as Record<string, unknown>)[key])) {
        patch[key] = value;
        filled[key] = value;
      }
    };
    consider("branche", profile.branche);
    consider("segment", profile.segment);
    consider("ort", profile.ort);
    consider("country", profile.country);

    if (Object.keys(patch).length > 0) {
      const { error: updErr } = await supabase
        .from("accounts")
        .update(patch)
        .eq("id", accountId)
        .eq("partner_id", pid);
      if (updErr) return { ok: false, error: updErr.message };
    }

    // Firmenbeschreibung als Notiz hinterlegen (best effort – nie blockierend).
    const beschreibung = profile.beschreibung?.trim() || undefined;
    if (beschreibung) {
      const extras = [
        profile.mitarbeiter_ca ? `Mitarbeiter ca. ${profile.mitarbeiter_ca}` : "",
        profile.gegruendet ? `gegründet ${profile.gegruendet}` : "",
      ].filter(Boolean);
      const body = `Firmenprofil (Web): ${beschreibung}${
        extras.length ? ` (${extras.join(", ")})` : ""
      }`;
      const { error: noteErr } = await supabase.from("account_notes").insert({
        partner_id: pid,
        account_id: accountId,
        body,
      });
      if (noteErr) logDataError("ai-actions:account_notes", noteErr);
    }

    revalidatePath(`/cockpit/kunden/${accountId}`);
    return { ok: true, filled, beschreibung };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Anreicherung fehlgeschlagen.",
    };
  }
}
