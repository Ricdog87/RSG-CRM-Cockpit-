import "server-only";
import { createClient } from "@/lib/supabase/server";
import { useMockData } from "@/lib/env";
import { getProjectRef } from "@/lib/project-refs-data";
import { assertCanPresent } from "@/lib/dsgvo/consent";

/**
 * Search & Match: rankt Kandidaten gegen ein gespiegeltes HubSpot-Projekt
 * (project_refs). Score aus Skill-Overlap + Standort + Verfügbarkeit; nur
 * Kandidaten mit gültiger Einwilligung werden als „vorstellbar" markiert
 * (Consent-Gate, business-logic).
 */

export interface CandidateMatchHit {
  candidateId: string;
  name: string;
  score: number; // 0–100
  reasons: string[];
  availabilityStatus: string;
  vorstellbar: boolean; // gültige Einwilligung vorhanden?
}

type Row = Record<string, unknown>;

/** Akzent-/ß-tolerant kleinschreiben (wie lib/crm-search fold). */
function fold(s: unknown): string {
  return String(s ?? "")
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/ß/g, "ss")
    .toLowerCase()
    .trim();
}

function asSkills(v: unknown): string[] {
  return Array.isArray(v) ? v.map((x) => fold(x)).filter(Boolean) : [];
}

/**
 * Top-Kandidaten für ein Projekt. Reiht zuerst nach Score, prüft den
 * Consent-Status nur für die Top-`limit` (Performance).
 */
export async function rankCandidatesForProject(
  projectRefId: string,
  limit = 25
): Promise<{ ok: boolean; error?: string; project?: { titel: string | null }; hits: CandidateMatchHit[] }> {
  if (useMockData) return { ok: true, hits: [] };

  const project = await getProjectRef(projectRefId);
  if (!project) return { ok: false, error: "Projekt nicht gefunden.", hits: [] };

  const projSkills = project.skills.map(fold).filter(Boolean);
  const projOrt = fold(project.standort);
  const projText = fold([project.titel, project.anforderungen].filter(Boolean).join(" "));

  const supabase = createClient();
  const { data, error } = await supabase
    .from("candidates")
    .select("id, name, skills, location, availability, availability_status, seniority, verfuegbar_ab")
    .limit(2000);
  if (error || !data) return { ok: false, error: error?.message ?? "Keine Kandidaten.", hits: [] };

  const scored = (data as Row[]).map((c) => {
    const reasons: string[] = [];
    let score = 0;

    // 1) Skill-Overlap (max 60)
    const candSkills = asSkills(c.skills);
    const overlap = projSkills.filter((s) => candSkills.includes(s));
    // Zusätzlich: Projekt-Skills, die im Anforderungstext/Skill-Set auftauchen.
    const textHits = projSkills.filter(
      (s) => !overlap.includes(s) && projText && candSkills.some((cs) => cs.includes(s))
    );
    if (projSkills.length > 0) {
      const ratio = (overlap.length + textHits.length * 0.5) / projSkills.length;
      const sk = Math.round(Math.min(1, ratio) * 60);
      score += sk;
      if (overlap.length > 0) reasons.push(`${overlap.length}/${projSkills.length} Skills passen`);
    }

    // 2) Standort (max 20)
    const candOrt = fold(c.location);
    if (projOrt && candOrt && (candOrt.includes(projOrt) || projOrt.includes(candOrt))) {
      score += 20;
      reasons.push("Standort passt");
    }

    // 3) Verfügbarkeit/Status (max 20)
    const status = String(c.availability_status ?? "NEU");
    if (status === "AKTIV_VERFUEGBAR") {
      score += 20;
      reasons.push("aktiv verfügbar");
    } else if (status === "IN_VERMITTLUNG" || status === "NEU") {
      score += 8;
    } else if (status === "GESPERRT" || status === "INAKTIV" || status === "PLATZIERT") {
      score = Math.max(0, score - 30);
      reasons.push(status === "GESPERRT" ? "gesperrt" : status.toLowerCase());
    }

    return {
      candidateId: String(c.id),
      name: String(c.name ?? "—"),
      score: Math.max(0, Math.min(100, score)),
      reasons,
      availabilityStatus: status,
    };
  });

  scored.sort((a, b) => b.score - a.score || a.name.localeCompare(b.name, "de"));
  const top = scored.slice(0, limit);

  // Consent-Gate nur für die Top-Treffer prüfen.
  const hits: CandidateMatchHit[] = await Promise.all(
    top.map(async (t) => {
      const gate = await assertCanPresent(t.candidateId);
      return { ...t, vorstellbar: gate.ok };
    })
  );

  return { ok: true, project: { titel: project.titel }, hits };
}
