import { normalizeCompany, emailDomain, isGenericDomain } from "@/lib/dedupe";
import type { Account } from "@/lib/crm-types";

/**
 * Findet wahrscheinliche Account-Dubletten (read-only) – nützlich nach
 * CRM-Importen. Gruppiert nach normalisiertem Firmennamen und nach
 * (nicht-generischer) E-Mail-Domain.
 */
export interface DuplicateGroup {
  key: string;
  reason: "name" | "domain";
  accounts: Account[];
}

function pushTo(map: Map<string, Account[]>, key: string, a: Account) {
  const arr = map.get(key);
  if (arr) arr.push(a);
  else map.set(key, [a]);
}

export function findAccountDuplicates(accounts: Account[]): DuplicateGroup[] {
  const groups: DuplicateGroup[] = [];
  const seen = new Set<string>();

  // 1) Gleicher normalisierter Firmenname.
  const byName = new Map<string, Account[]>();
  for (const a of accounts) {
    if (a.synthetic) continue;
    const k = normalizeCompany(a.name);
    if (k) pushTo(byName, k, a);
  }
  for (const [k, arr] of byName) {
    if (arr.length > 1) {
      groups.push({ key: k, reason: "name", accounts: arr });
      arr.forEach((a) => seen.add(a.id));
    }
  }

  // 2) Gleiche Firmen-Domain (nicht generisch), noch nicht gruppiert.
  const byDomain = new Map<string, Account[]>();
  for (const a of accounts) {
    if (a.synthetic) continue;
    const d = emailDomain(a.contact_email);
    if (d && !isGenericDomain(d)) pushTo(byDomain, d, a);
  }
  for (const [d, arr] of byDomain) {
    const fresh = arr.filter((a) => !seen.has(a.id));
    if (fresh.length > 1) {
      groups.push({ key: d, reason: "domain", accounts: fresh });
      fresh.forEach((a) => seen.add(a.id));
    }
  }

  return groups.sort((a, b) => b.accounts.length - a.accounts.length);
}
