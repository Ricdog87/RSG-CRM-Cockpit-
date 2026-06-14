/**
 * Intelligenter Abgleich gegen Dubletten. Normalisiert Firmennamen
 * (Rechtsformen/Sonderzeichen raus) und vergleicht zusätzlich die E-Mail-Domain.
 */
const LEGAL =
  /\b(gmbh|mbh|ag|kgaa|kg|ohg|ug|haftungsbeschr(ä|ae)nkt|e\.?\s?k|e\.?\s?v|gbr|se|co|inc|ltd|llc|holding|group|gruppe)\b/gi;

// Generische Mail-Domains zählen NICHT als Firmen-Match.
const GENERIC_DOMAINS = new Set([
  "gmail.com",
  "googlemail.com",
  "outlook.com",
  "hotmail.com",
  "hotmail.de",
  "web.de",
  "gmx.de",
  "gmx.net",
  "t-online.de",
  "yahoo.com",
  "yahoo.de",
  "icloud.com",
  "live.com",
  "aol.com",
]);

export function normalizeCompany(name: string): string {
  return (name || "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9& ]/g, " ")
    .replace(LEGAL, " ")
    .replace(/\b&\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function emailDomain(email?: string): string {
  if (!email) return "";
  const at = email.indexOf("@");
  if (at === -1) return "";
  return email.slice(at + 1).toLowerCase().trim();
}

export interface DedupeKey {
  name: string;
  email?: string;
}

/** Zwei Einträge sind wahrscheinlich dieselbe Firma. */
export function isLikelyDuplicate(a: DedupeKey, b: DedupeKey): boolean {
  const na = normalizeCompany(a.name);
  const nb = normalizeCompany(b.name);
  if (na && nb && na === nb) return true;

  const da = emailDomain(a.email);
  const db = emailDomain(b.email);
  if (da && db && da === db && !GENERIC_DOMAINS.has(da)) return true;

  // Starke Teilüberlappung des Namens (ein Name im anderen enthalten, ≥ 4 Zeichen).
  if (na.length >= 4 && nb.length >= 4 && (na.includes(nb) || nb.includes(na))) {
    return true;
  }
  return false;
}

/** Findet den ersten wahrscheinlichen Dubletten-Treffer in einer Liste. */
export function findDuplicate<T extends DedupeKey>(
  candidate: DedupeKey,
  existing: T[]
): T | undefined {
  return existing.find((e) => isLikelyDuplicate(candidate, e));
}
