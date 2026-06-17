"use server";

import { createClient } from "@/lib/supabase/server";
import { useMockData } from "@/lib/env";
import { aiConfigured } from "@/lib/ai/config";
import { llmComplete, extractJson } from "@/lib/ai/llm";

export interface MatchResult {
  ok: boolean;
  error?: string;
  demo?: boolean;
  score?: number;
  summary?: string;
  target_role?: string;
}

/**
 * Bewertet per KI die Passung einer:s Kandidat:in zum verknüpften Mandat
 * (Rolle/Skills ↔ zu besetzende Rolle). Liefert Score 0–100 + kurze Begründung.
 */
export async function matchCandidateToMandate(candidateId: string): Promise<MatchResult> {
  if (useMockData)
    return {
      ok: true,
      demo: true,
      score: 78,
      summary:
        "Demo: solide Passung – relevante Berufserfahrung, mehrere Kern-Skills decken die Anforderungen des Mandats ab. Mit echter Supabase + KI-Key wird hier individuell bewertet.",
      target_role: "—",
    };
  if (!aiConfigured) return { ok: false, error: "KI nicht verbunden (ANTHROPIC_API_KEY fehlt)." };

  const supabase = createClient();
  const { data: cand } = await supabase
    .from("candidates")
    .select("name, role, skills, mandate_account")
    .eq("id", candidateId)
    .maybeSingle();
  if (!cand) return { ok: false, error: "Kandidat:in nicht gefunden." };
  const c = cand as { name?: string; role?: string; skills?: unknown; mandate_account?: string };

  const mandateName = c.mandate_account ?? "";
  let targetRole = "";
  if (mandateName) {
    const { data: m } = await supabase
      .from("recruiting_mandates")
      .select("role")
      .ilike("account_name", mandateName)
      .limit(1)
      .maybeSingle();
    targetRole = (m as { role?: string } | null)?.role ?? "";
  }

  const skills = Array.isArray(c.skills) ? (c.skills as unknown[]).map(String) : [];
  const user = [
    `Kandidat:in: ${c.name ?? "—"}`,
    `Aktuelle/letzte Rolle: ${c.role || "—"}`,
    `Skills: ${skills.join(", ") || "—"}`,
    `Mandat / Account: ${mandateName || "—"}`,
    `Zu besetzende Rolle: ${targetRole || "unbekannt"}`,
    "",
    'Bewerte die Passung als JSON: {"score": Zahl 0-100, "summary": ein bis zwei Sätze auf Deutsch mit Begründung}. Wenn die Zielrolle unbekannt ist, bewerte vorsichtiger und weise darauf hin.',
  ].join("\n");
  const system =
    "Du bist erfahrene:r Personalberater:in und bewertest nüchtern die Passung zwischen einer:m Kandidat:in und einem Recruiting-Mandat.";

  try {
    const raw = await llmComplete(system, user);
    const j = extractJson<{ score?: unknown; summary?: unknown }>(raw);
    const score = Math.max(0, Math.min(100, Math.round(Number(j.score) || 0)));
    return { ok: true, score, summary: String(j.summary ?? ""), target_role: targetRole || undefined };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Bewertung fehlgeschlagen." };
  }
}
