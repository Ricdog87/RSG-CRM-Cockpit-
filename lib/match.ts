"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { useMockData } from "@/lib/env";
import { aiConfigured } from "@/lib/ai/config";
import { llmComplete, extractJson } from "@/lib/ai/llm";
import { getCandidates, getCandidate, getAccounts, getMandates } from "@/lib/crm-data";
import { resolveCoords, distanceKm } from "@/lib/geo";
import type { Candidate, RecruitingMandate } from "@/lib/crm-types";

export interface CandidateMatch {
  id: string;
  name: string;
  role: string;
  location?: string;
  salary_expectation?: number;
  availability?: string;
  rating?: number;
  score: number;
  factors: string[];
  already: boolean;
  /** Hat für DIESES Mandat bereits eine Absage erhalten. */
  rejected: boolean;
}

export interface MandateMatch {
  mandate_id: string;
  account_name: string;
  role: string;
  score: number;
  factors: string[];
  already: boolean;
}

function tokens(s: string): string[] {
  return (s || "")
    .toLowerCase()
    .replace(/[^a-zäöüß0-9\s]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length >= 3);
}

type Coords = { lat: number; lng: number } | null;

/** Reine Bewertungsfunktion Kandidat:in ↔ Mandat (mit echter Distanz). */
function scoreMatch(
  cand: Pick<
    Candidate,
    "role" | "skills" | "zip" | "location" | "willing_to_relocate" | "salary_expectation" | "availability"
  >,
  mandate: Pick<
    RecruitingMandate,
    "role" | "target_salary" | "job_posting" | "job_posting_anonymized"
  >,
  jobCoords: Coords
): { score: number; factors: string[] } {
  const factors: string[] = [];

  // Rolle & Skills (0–50): Rollen-Titel (0–40) + Keyword-Treffer aus der
  // hinterlegten Stellenausschreibung (0–10) → intelligenteres Matching.
  const roleTokens = new Set(tokens(mandate.role));
  const candTokens = new Set([...tokens(cand.role), ...(cand.skills ?? []).flatMap(tokens)]);
  let overlap = 0;
  roleTokens.forEach((t) => {
    if (candTokens.has(t)) overlap++;
  });
  const roleBase = roleTokens.size > 0 ? (overlap / roleTokens.size) * 40 : 20;

  const postingText = mandate.job_posting_anonymized || mandate.job_posting || "";
  const jobTokens = new Set(tokens(postingText));
  let kwHits = 0;
  if (jobTokens.size) candTokens.forEach((t) => { if (jobTokens.has(t)) kwHits++; });
  const kwBonus = Math.min(10, kwHits * 2);

  const roleScore = Math.round(roleBase + kwBonus);
  if (roleScore >= 25) factors.push("Rolle passt");
  if (kwBonus >= 4) factors.push("Anzeige-Keywords passen");

  // Standort über Distanz (0–20)
  let locScore = 8;
  const candCoords = resolveCoords(cand.zip, cand.location);
  if (jobCoords && candCoords) {
    const d = distanceKm(jobCoords, candCoords);
    if (d <= 30) {
      locScore = 20;
      factors.push(`Region passt (${d} km)`);
    } else if (d <= 80) {
      locScore = 16;
      factors.push(`${d} km entfernt`);
    } else if (d <= 150) {
      locScore = cand.willing_to_relocate ? 14 : 10;
      factors.push(cand.willing_to_relocate ? `umzugsbereit (${d} km)` : `${d} km entfernt`);
    } else {
      locScore = cand.willing_to_relocate ? 12 : 5;
      if (cand.willing_to_relocate) factors.push(`umzugsbereit (${d} km)`);
    }
  } else if (cand.willing_to_relocate) {
    locScore = 14;
    factors.push("umzugsbereit");
  }

  // Gehalt (0–20)
  let salScore = 10;
  const ts = mandate.target_salary ?? 0;
  if (cand.salary_expectation && ts) {
    if (cand.salary_expectation <= ts) {
      salScore = 20;
      factors.push("Gehalt passt");
    } else if (cand.salary_expectation <= ts * 1.15) {
      salScore = 12;
    } else {
      salScore = 4;
    }
  }

  // Verfügbarkeit (0–10)
  const avScore = cand.availability ? 10 : 5;
  if (cand.availability) factors.push("verfügbar");

  return { score: Math.min(100, roleScore + locScore + salScore + avScore), factors };
}

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

async function submittedPairs(): Promise<Set<string>> {
  const set = new Set<string>();
  if (useMockData) return set;
  try {
    const supabase = createClient();
    const { data } = await supabase
      .from("candidate_submissions")
      .select("candidate_id, mandate_id");
    for (const r of (data as Array<{ candidate_id: string; mandate_id: string | null }> | null) ?? [])
      set.add(`${r.candidate_id}:${r.mandate_id}`);
  } catch {
    /* Tabelle evtl. nicht migriert */
  }
  return set;
}

/** Search & Match: passende Kandidat:innen zu einem Mandat (Rangliste). */
export async function matchCandidatesToMandate(
  mandateId: string
): Promise<{ ok: boolean; error?: string; mandateRole?: string; matches?: CandidateMatch[] }> {
  const [mandates, accounts, candidates, pairs] = await Promise.all([
    getMandates(),
    getAccounts(),
    getCandidates(),
    submittedPairs(),
  ]);
  const m = mandates.find((x) => x.id === mandateId);
  if (!m) return { ok: false, error: "Mandat nicht gefunden." };
  const account = accounts.find((a) => a.name === m.account_name);
  const jobCoords = resolveCoords(undefined, account?.ort);

  const matches: CandidateMatch[] = candidates.map((c) => {
    const { score, factors } = scoreMatch(c, m, jobCoords);
    // Absage für genau dieses Mandat (zugeordnet + Phase „abgelehnt").
    const rejected = c.mandate_id === mandateId && c.stage === "abgelehnt";
    return {
      id: c.id,
      name: c.name,
      role: c.role,
      location: c.location,
      salary_expectation: c.salary_expectation,
      availability: c.availability,
      rating: c.rating,
      score,
      factors,
      already: pairs.has(`${c.id}:${mandateId}`),
      rejected,
    };
  });

  // Abgesagte Kandidat:innen nach ganz unten, dann bereits vorgestellte, dann Score.
  matches.sort(
    (a, b) =>
      Number(a.rejected) - Number(b.rejected) ||
      Number(a.already) - Number(b.already) ||
      b.score - a.score
  );
  return { ok: true, mandateRole: m.role, matches: matches.slice(0, 25) };
}

/** Reverse-Match: passende OFFENE Mandate für eine:n Kandidat:in. */
export async function matchMandatesForCandidate(
  candidateId: string
): Promise<{ ok: boolean; error?: string; matches?: MandateMatch[] }> {
  const [cand, mandates, accounts, pairs] = await Promise.all([
    getCandidate(candidateId),
    getMandates(),
    getAccounts(),
    submittedPairs(),
  ]);
  if (!cand) return { ok: false, error: "Kandidat:in nicht gefunden." };

  const open = mandates.filter((m) => m.status !== "besetzt" && m.positions > m.filled);
  const matches: MandateMatch[] = open.map((m) => {
    const account = accounts.find((a) => a.name === m.account_name);
    const jobCoords = resolveCoords(undefined, account?.ort);
    const { score, factors } = scoreMatch(cand, m, jobCoords);
    return {
      mandate_id: m.id,
      account_name: m.account_name,
      role: m.role,
      score,
      factors,
      already: pairs.has(`${candidateId}:${m.id}`),
    };
  });

  matches.sort((a, b) => Number(a.already) - Number(b.already) || b.score - a.score);
  return { ok: true, matches: matches.slice(0, 15) };
}

export interface DeepAnalysis {
  fit: number;
  strengths: string[];
  gaps: string[];
  recommendation: string;
}

/** KI-Tiefenanalyse: begründet die Passung Kandidat:in ↔ Mandat im Detail. */
export async function analyzeMatch(
  candidateId: string,
  mandateId: string
): Promise<{ ok: boolean; error?: string; demo?: boolean; analysis?: DeepAnalysis }> {
  if (useMockData)
    return {
      ok: true,
      demo: true,
      analysis: {
        fit: 76,
        strengths: ["Relevante Rolle", "Region passt", "Verfügbar"],
        gaps: ["Gehaltsvorstellung leicht über Zielwert"],
        recommendation: "Vorstellen empfohlen – kurzes Screening zur Gehaltsklärung.",
      },
    };
  if (!aiConfigured) return { ok: false, error: "KI nicht verbunden (ANTHROPIC_API_KEY fehlt)." };

  const [cand, mandates, accounts] = await Promise.all([getCandidate(candidateId), getMandates(), getAccounts()]);
  if (!cand) return { ok: false, error: "Kandidat:in nicht gefunden." };
  const m = mandates.find((x) => x.id === mandateId);
  if (!m) return { ok: false, error: "Mandat nicht gefunden." };
  const account = accounts.find((a) => a.name === m.account_name);

  const user = [
    `KANDIDAT:IN`,
    `Rolle: ${cand.role || "—"}`,
    `Skills: ${(cand.skills ?? []).join(", ") || "—"}`,
    `Ort/PLZ: ${[cand.location, cand.zip].filter(Boolean).join(" ") || "—"}`,
    `Umzugsbereit: ${cand.willing_to_relocate == null ? "unbekannt" : cand.willing_to_relocate ? "ja" : "nein"}`,
    `Reisebereitschaft: ${cand.travel_willingness || "—"}`,
    `Gehaltsvorstellung: ${cand.salary_expectation ? cand.salary_expectation + " €/Jahr" : "—"}`,
    `Verfügbarkeit: ${cand.availability || "—"}`,
    ``,
    `MANDAT`,
    `Zu besetzende Rolle: ${m.role || "—"}`,
    `Kunde: ${m.account_name} (${account?.ort || "Ort unbekannt"})`,
    `Zielgehalt: ${m.target_salary ? m.target_salary + " €/Jahr" : "—"}`,
    ``,
    'Bewerte als JSON: {"fit": 0-100, "strengths": [kurze Strings], "gaps": [kurze Strings], "recommendation": ein Satz auf Deutsch}.',
  ].join("\n");
  const system =
    "Du bist erfahrene:r Personalberater:in und bewertest nüchtern die Passung zwischen einer:m Kandidat:in und einem Recruiting-Mandat.";

  try {
    const raw = await llmComplete(system, user);
    const j = extractJson<Partial<DeepAnalysis>>(raw);
    return {
      ok: true,
      analysis: {
        fit: Math.max(0, Math.min(100, Math.round(Number(j.fit) || 0))),
        strengths: Array.isArray(j.strengths) ? j.strengths.map(String).slice(0, 6) : [],
        gaps: Array.isArray(j.gaps) ? j.gaps.map(String).slice(0, 6) : [],
        recommendation: String(j.recommendation ?? ""),
      },
    };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Analyse fehlgeschlagen." };
  }
}

/**
 * Stellt eine:n Kandidat:in einem Mandat vor: legt einen Historien-Eintrag an
 * (gegen Doppelbewerbung) und setzt die aktuelle Mandatszuordnung.
 */
export async function submitCandidateToMandate(
  candidateId: string,
  mandateId: string
): Promise<{ ok: boolean; error?: string; demo?: boolean; already?: boolean }> {
  if (useMockData) return { ok: true, demo: true };
  const { id: pid, error } = await currentPartnerId();
  if (!pid) return { ok: false, error };
  const supabase = createClient();

  const { data: mandate } = await supabase
    .from("recruiting_mandates")
    .select("account_name, role")
    .eq("id", mandateId)
    .eq("partner_id", pid)
    .maybeSingle();
  if (!mandate) return { ok: false, error: "Mandat nicht gefunden." };
  const md = (mandate as { account_name?: string; role?: string } | null) ?? null;

  const { data: existing } = await supabase
    .from("candidate_submissions")
    .select("id")
    .eq("candidate_id", candidateId)
    .eq("mandate_id", mandateId)
    .eq("partner_id", pid)
    .maybeSingle();
  if (existing) return { ok: true, already: true };

  const { error: insErr } = await supabase.from("candidate_submissions").insert({
    partner_id: pid,
    candidate_id: candidateId,
    mandate_id: mandateId,
    account_name: md?.account_name ?? null,
    role: md?.role ?? null,
    stage: "vorgestellt",
  });
  if (insErr) {
    if (/relation .*candidate_submissions.* does not exist/i.test(insErr.message)) {
      return { ok: false, error: "Tabelle candidate_submissions fehlt – Migration 08 ausführen." };
    }
    return { ok: false, error: insErr.message };
  }

  await supabase.from("candidates").update({ mandate_id: mandateId }).eq("id", candidateId).eq("partner_id", pid);

  revalidatePath(`/cockpit/projekte/recruiting/${mandateId}`);
  revalidatePath(`/cockpit/kandidaten/${candidateId}`);
  return { ok: true };
}
