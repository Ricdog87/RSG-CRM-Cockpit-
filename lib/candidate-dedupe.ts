import type { Candidate } from "@/lib/crm-types";

/**
 * Findet wahrscheinliche Kandidaten-Dubletten (read-only) – verhindert, dass
 * dieselbe Person doppelt angesprochen oder mehreren Mandaten zugeordnet wird.
 * Match über: identische E-Mail, identische Telefonnummer (normalisiert) oder
 * identischer Personenname (normalisiert).
 */
export interface CandidateDuplicateGroup {
  key: string;
  reason: "email" | "phone" | "name";
  candidates: Candidate[];
}

/** Personenname normalisieren: klein, ohne Titel/Sonderzeichen, sortierte Tokens. */
export function normalizePerson(name: string): string {
  return (name || "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/\b(dr|prof|dipl|ing|med|mba|m\.?\s?sc|b\.?\s?sc|herr|frau)\b\.?/g, " ")
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .sort()
    .join(" ");
}

/** Telefonnummer auf Ziffern reduzieren (führende 0/+49 vereinheitlicht). */
export function normalizePhone(phone?: string): string {
  if (!phone) return "";
  let d = phone.replace(/[^\d+]/g, "");
  d = d.replace(/^\+?49/, "0").replace(/[^\d]/g, "");
  return d.length >= 6 ? d : "";
}

function pushTo(map: Map<string, Candidate[]>, key: string, c: Candidate) {
  const arr = map.get(key);
  if (arr) arr.push(c);
  else map.set(key, [c]);
}

export function findCandidateDuplicates(candidates: Candidate[]): CandidateDuplicateGroup[] {
  const groups: CandidateDuplicateGroup[] = [];
  const seen = new Set<string>();

  const collect = (
    keyOf: (c: Candidate) => string,
    reason: CandidateDuplicateGroup["reason"]
  ) => {
    const by = new Map<string, Candidate[]>();
    for (const c of candidates) {
      if (seen.has(c.id)) continue;
      const k = keyOf(c);
      if (k) pushTo(by, k, c);
    }
    for (const [k, arr] of by) {
      if (arr.length > 1) {
        groups.push({ key: k, reason, candidates: arr });
        arr.forEach((c) => seen.add(c.id));
      }
    }
  };

  // Reihenfolge = Verlässlichkeit: E-Mail > Telefon > Name.
  collect((c) => (c.email ? c.email.toLowerCase().trim() : ""), "email");
  collect((c) => normalizePhone(c.phone), "phone");
  collect((c) => normalizePerson(c.name), "name");

  return groups.sort((a, b) => b.candidates.length - a.candidates.length);
}

/** Anzeigetext für einen Gruppenschlüssel. */
export function dupeReasonLabel(g: CandidateDuplicateGroup): string {
  if (g.reason === "email") return `E-Mail: ${g.key}`;
  if (g.reason === "phone") return "gleiche Telefonnummer";
  return "gleicher Name";
}
