/**
 * Erzeugt pragmatische Boolean-/Keyword-Suchstrings für aktives Sourcing
 * (LinkedIn, Indeed, StepStone, X-Ray Google), damit Recruiter:innen schnell
 * passende Kandidat:innen ODER passende Auftraggeber/Mandate finden, wenn
 * intern kein Suchmandat passt. Reine Funktion (kein Server-Import).
 */
export interface SourcingInput {
  role?: string;
  skills?: string[];
  location?: string;
  /** Optionale Ziel-Rollen/Synonyme (z.B. aus der KI-Analyse). */
  targetRoles?: string[];
}

export interface SourcingQueries {
  linkedin: string;
  indeed: string;
  stepstone: string;
  googleXray: string;
  keywords: string[];
}

function clean(s?: string): string {
  return (s || "").replace(/["()]/g, "").replace(/\s+/g, " ").trim();
}

function quote(s: string): string {
  const c = clean(s);
  return c.includes(" ") ? `"${c}"` : c;
}

/** Baut eine OR-Gruppe aus mehreren Begriffen: (a OR b OR c). */
function orGroup(terms: string[]): string {
  const uniq = Array.from(new Set(terms.map(clean).filter(Boolean)));
  if (uniq.length === 0) return "";
  if (uniq.length === 1) return quote(uniq[0]);
  return `(${uniq.map(quote).join(" OR ")})`;
}

export function buildSourcingQueries(input: SourcingInput): SourcingQueries {
  const role = clean(input.role);
  const roles = [role, ...(input.targetRoles ?? [])].map(clean).filter(Boolean);
  const skills = (input.skills ?? []).map(clean).filter(Boolean);
  const loc = clean(input.location);

  const roleGroup = orGroup(roles.length ? roles : [role || "Spezialist"]);
  // Top-Skills als AND-verknüpfte OR-Gruppe (max. 5, sonst zu eng).
  const topSkills = skills.slice(0, 5);
  const skillGroup = topSkills.length ? orGroup(topSkills) : "";

  const linkedinParts = [roleGroup, skillGroup].filter(Boolean);
  const linkedin = linkedinParts.join(" AND ");

  // Indeed: Titel + Skills, Ort separat (Indeed hat eigenes Ortsfeld).
  const indeed = [roleGroup, skillGroup].filter(Boolean).join(" ");

  // StepStone: Keyword-orientiert, Ort als Zusatz.
  const stepstone = [role || roles[0] || "", topSkills.slice(0, 3).join(" ")]
    .filter(Boolean)
    .join(" ")
    .trim();

  // Google X-Ray auf LinkedIn-Profile.
  const googleXray = [
    "site:linkedin.com/in",
    roleGroup,
    skillGroup,
    loc ? quote(loc) : "",
  ]
    .filter(Boolean)
    .join(" ");

  const keywords = Array.from(new Set([...roles, ...topSkills])).slice(0, 12);

  return { linkedin, indeed, stepstone, googleXray, keywords };
}
