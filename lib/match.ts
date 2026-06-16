"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { useMockData } from "@/lib/env";
import { getCandidates, getAccounts, getMandates } from "@/lib/crm-data";

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
}

function tokens(s: string): string[] {
  return (s || "")
    .toLowerCase()
    .replace(/[^a-zäöüß0-9\s]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length >= 3);
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

/**
 * Smart Search & Match: bewertet alle Kandidat:innen gegen ein Mandat
 * (Rolle/Skills, Standort, Gehalt, Verfügbarkeit) und liefert eine Rangliste.
 * Bereits vorgestellte werden markiert (gegen Doppelbewerbung).
 */
export async function matchCandidatesToMandate(
  mandateId: string
): Promise<{ ok: boolean; error?: string; mandateRole?: string; matches?: CandidateMatch[] }> {
  const [mandates, accounts, candidates] = await Promise.all([
    getMandates(),
    getAccounts(),
    getCandidates(),
  ]);
  const m = mandates.find((x) => x.id === mandateId);
  if (!m) return { ok: false, error: "Mandat nicht gefunden." };
  const account = accounts.find((a) => a.name === m.account_name);
  const jobLocation = (account?.ort || "").toLowerCase();
  const targetSalary = m.target_salary ?? 0;

  // Bereits vorgestellte Kandidat:innen für dieses Mandat.
  const submitted = new Set<string>();
  if (!useMockData) {
    try {
      const supabase = createClient();
      const { data } = await supabase
        .from("candidate_submissions")
        .select("candidate_id")
        .eq("mandate_id", mandateId);
      for (const r of (data as Array<{ candidate_id: string }> | null) ?? [])
        submitted.add(r.candidate_id);
    } catch {
      /* Tabelle evtl. nicht migriert – ignorieren */
    }
  }

  const roleTokens = new Set(tokens(m.role));

  const matches: CandidateMatch[] = candidates.map((c) => {
    const factors: string[] = [];

    // Rolle & Skills (0–50)
    const candTokens = new Set([...tokens(c.role), ...(c.skills ?? []).flatMap(tokens)]);
    let overlap = 0;
    roleTokens.forEach((t) => {
      if (candTokens.has(t)) overlap++;
    });
    const roleScore = roleTokens.size > 0 ? Math.round((overlap / roleTokens.size) * 50) : 25;
    if (roleScore >= 25) factors.push("Rolle passt");

    // Standort (0–20)
    let locScore = 8;
    const cl = (c.location || "").toLowerCase();
    if (jobLocation && cl && (cl.includes(jobLocation) || jobLocation.includes(cl))) {
      locScore = 20;
      factors.push("Region passt");
    } else if (c.willing_to_relocate) {
      locScore = 14;
      factors.push("umzugsbereit");
    } else if (!cl) {
      locScore = 8;
    } else {
      locScore = 5;
    }

    // Gehalt (0–20)
    let salScore = 10;
    if (c.salary_expectation && targetSalary) {
      if (c.salary_expectation <= targetSalary) {
        salScore = 20;
        factors.push("Gehalt passt");
      } else if (c.salary_expectation <= targetSalary * 1.15) {
        salScore = 12;
      } else {
        salScore = 4;
      }
    }

    // Verfügbarkeit (0–10)
    const avScore = c.availability ? 10 : 5;
    if (c.availability) factors.push("verfügbar");

    const score = Math.min(100, roleScore + locScore + salScore + avScore);
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
      already: submitted.has(c.id),
    };
  });

  matches.sort((a, b) => Number(a.already) - Number(b.already) || b.score - a.score);
  return { ok: true, mandateRole: m.role, matches: matches.slice(0, 25) };
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
    .maybeSingle();
  const md = (mandate as { account_name?: string; role?: string } | null) ?? null;

  // Doppelbewerbung verhindern.
  const { data: existing } = await supabase
    .from("candidate_submissions")
    .select("id")
    .eq("candidate_id", candidateId)
    .eq("mandate_id", mandateId)
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

  // Aktuelle Mandatszuordnung setzen (best effort).
  await supabase.from("candidates").update({ mandate_id: mandateId }).eq("id", candidateId);

  revalidatePath(`/cockpit/projekte/recruiting/${mandateId}`);
  revalidatePath(`/cockpit/kandidaten/${candidateId}`);
  return { ok: true };
}
