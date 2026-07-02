import "server-only";
import { createClient } from "@/lib/supabase/server";
import { useMockData } from "@/lib/env";
import { getProjectRef } from "@/lib/project-refs-data";
import { batchCanPresent } from "@/lib/dsgvo/consent";

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
  // Alle Kandidaten paginiert laden (.limit wird von PostgREST auf 1000 gekappt).
  const rows: Row[] = [];
  for (let page = 0; page < 20; page++) {
    const { data, error } = await supabase
      .from("candidates")
      .select("id, name, skills, location, availability, availability_status, seniority, verfuegbar_ab")
      .order("id", { ascending: true })
      .range(page * 1000, page * 1000 + 999);
    if (error) return { ok: false, error: error.message, hits: [] };
    if (!data || data.length === 0) break;
    rows.push(...(data as Row[]));
    if (data.length < 1000) break;
  }

  const scored = rows.map((c) => {
    const reasons: string[] = [];
    let score = 0;

    // 1) Skill-Overlap (max 60). Fallback ohne strukturierte Projekt-Skills:
    //    Kandidaten-Skills im Projekttext (Deal-Name/Anforderungen) suchen.
    const candSkills = asSkills(c.skills);
    if (projSkills.length > 0) {
      const overlap = projSkills.filter((s) => candSkills.includes(s));
      const textHits = projSkills.filter(
        (s) => !overlap.includes(s) && projText && candSkills.some((cs) => cs.includes(s))
      );
      const ratio = (overlap.length + textHits.length * 0.5) / projSkills.length;
      score += Math.round(Math.min(1, ratio) * 60);
      if (overlap.length > 0) reasons.push(`${overlap.length}/${projSkills.length} Skills passen`);
    } else if (projText && candSkills.length > 0) {
      const inText = candSkills.filter((cs) => cs.length >= 3 && projText.includes(cs));
      if (inText.length > 0) {
        score += Math.round(Math.min(1, inText.length / 4) * 50);
        reasons.push(`${inText.length} Skill-Treffer im Projekttext`);
      }
    }

    // 2) Standort (max 20). Fallback: Ort im Projekttext (Deal-Name).
    const candOrt = fold(c.location);
    if (candOrt && candOrt.length >= 3) {
      if (projOrt && (candOrt.includes(projOrt) || projOrt.includes(candOrt))) {
        score += 20;
        reasons.push("Standort passt");
      } else if (!projOrt && projText.includes(candOrt)) {
        score += 15;
        reasons.push("Ort im Projekttext");
      }
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

  // Consent-Gate für die Top-Treffer – EINE Query statt N Einzelabfragen.
  const presentable = await batchCanPresent(top.map((t) => t.candidateId));
  const hits: CandidateMatchHit[] = top.map((t) => ({ ...t, vorstellbar: presentable.has(t.candidateId) }));

  return { ok: true, project: { titel: project.titel }, hits };
}
