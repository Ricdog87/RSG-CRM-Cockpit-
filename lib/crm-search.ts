import {
  getAccounts,
  getOpportunities,
  getCandidates,
  getMandates,
  getKiProjects,
} from "@/lib/crm-data";

export interface SearchHit {
  href: string;
  title: string;
  subtitle: string;
}

export interface SearchGroup {
  label: string;
  kind: "kunde" | "chance" | "kandidat" | "mandat" | "ki";
  hits: SearchHit[];
}

export function candNo(n?: number): string {
  return n != null ? `RSG-${String(n).padStart(5, "0")}` : "";
}

function match(q: string, ...fields: (string | undefined)[]) {
  return fields.some((f) => (f ?? "").toLowerCase().includes(q));
}

/**
 * Durchsucht alle CRM-Entitäten (eigentümer-/sessiongebunden über die
 * crm-data-Funktionen) und liefert gruppierte Treffer. Wird von der
 * Suchseite und der Command-Palette (API) gemeinsam genutzt.
 */
export async function runCrmSearch(
  rawQuery: string,
  perGroup = 50
): Promise<{ groups: SearchGroup[]; total: number }> {
  const q = rawQuery.trim().toLowerCase();
  if (!q) return { groups: [], total: 0 };

  const [accounts, opportunities, candidates, mandates, kiProjects] = await Promise.all([
    getAccounts(),
    getOpportunities(),
    getCandidates(),
    getMandates(),
    getKiProjects(),
  ]);

  const accountHits: SearchHit[] = accounts
    .filter((a) => match(q, a.name, a.branche, a.contact_name, a.segment, a.ort))
    .map((a) => ({
      href: `/cockpit/kunden/${a.id}`,
      title: a.name,
      subtitle: [a.branche, a.contact_name].filter(Boolean).join(" · ") || a.line,
    }));

  const oppHits: SearchHit[] = opportunities
    .filter((o) => match(q, o.account_name, o.title, o.owner))
    .map((o) => ({
      href: "/cockpit/sales",
      title: o.title || o.account_name,
      subtitle: `${o.account_name} · ${o.stage}`,
    }));

  const candHits: SearchHit[] = candidates
    .filter((c) =>
      match(q, c.name, c.role, c.mandate_account, c.source, candNo(c.candidate_no), String(c.candidate_no ?? ""))
    )
    .map((c) => ({
      href: `/cockpit/kandidaten/${c.id}`,
      title: [c.title, c.name].filter(Boolean).join(" "),
      subtitle: [candNo(c.candidate_no), c.role, c.mandate_account].filter(Boolean).join(" · "),
    }));

  const mandateHits: SearchHit[] = mandates
    .filter((m) => match(q, m.account_name, m.role))
    .map((m) => ({
      href: `/cockpit/projekte/recruiting/${m.id}`,
      title: m.role,
      subtitle: `${m.account_name} · ${m.status}`,
    }));

  const kiHits: SearchHit[] = kiProjects
    .filter((p) => match(q, p.account_name, p.product, p.segment))
    .map((p) => ({
      href: `/cockpit/projekte/ki/${p.id}`,
      title: `${p.product || "KI-Projekt"} · ${p.account_name}`,
      subtitle: `${p.status}${p.mrr ? ` · ${p.mrr} €/M` : ""}`,
    }));

  const groups: SearchGroup[] = [
    { label: "Kunden", kind: "kunde", hits: accountHits },
    { label: "Verkaufschancen", kind: "chance", hits: oppHits },
    { label: "Kandidaten", kind: "kandidat", hits: candHits },
    { label: "Mandate", kind: "mandat", hits: mandateHits },
    { label: "KI-Projekte", kind: "ki", hits: kiHits },
  ];

  const total = groups.reduce((s, g) => s + g.hits.length, 0);
  // Pro Gruppe begrenzen (Palette/Performance).
  for (const g of groups) g.hits = g.hits.slice(0, perGroup);

  return { groups, total };
}
