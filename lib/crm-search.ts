import {
  getAccounts,
  getOpportunities,
  getCandidates,
  getMandates,
  getKiProjects,
} from "@/lib/crm-data";
import { getProjectRefs } from "@/lib/project-refs-data";

export interface SearchHit {
  href: string;
  title: string;
  subtitle: string;
  /** Tertiaerzeile (E-Mail/Telefon/Ort) */
  meta?: string;
  /** kleines Status/Typ-Tag */
  badge?: string;
  /** Relevanz fuer Ranking */
  score: number;
}

export interface SearchGroup {
  label: string;
  kind: "kunde" | "chance" | "kandidat" | "mandat" | "ki" | "projekt";
  hits: SearchHit[];
}

export function candNo(n?: number): string {
  return n != null ? `RSG-${String(n).padStart(5, "0")}` : "";
}

/** Akzent-/ss-tolerantes Falten: "Lagardère" -> "lagardere", "Roß" -> "ross". */
export function fold(s: string | undefined | null): string {
  return (s ?? "")
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/ß/g, "ss")
    .toLowerCase();
}

/** 3 = Wortanfang, 2 = an Wortgrenze, 1 = enthalten, 0 = kein Treffer. */
function fieldScore(folded: string, token: string): number {
  if (!folded) return 0;
  const i = folded.indexOf(token);
  if (i < 0) return 0;
  if (i === 0) return 3;
  const prev = folded[i - 1];
  if (prev === " " || prev === "-" || prev === "@" || prev === ".") return 2;
  return 1;
}

interface Field {
  value?: string;
  weight: number;
}

/** Jeder Token muss IRGENDWO matchen (UND-Logik), gewichtet summiert. */
function scoreRecord(tokens: string[], fields: Field[]): number {
  const folded = fields.map((f) => ({ f: fold(f.value), w: f.weight }));
  let total = 0;
  for (const tok of tokens) {
    let best = 0;
    for (const { f, w } of folded) best = Math.max(best, fieldScore(f, tok) * w);
    if (best === 0) return 0;
    total += best;
  }
  return total;
}

function joinDot(...parts: (string | undefined | null)[]): string {
  return parts.map((p) => (p ?? "").trim()).filter(Boolean).join(" · ");
}

/**
 * Durchsucht alle CRM-Entitäten (session-/eigentümergebunden über crm-data)
 * akzent-/ss-tolerant, multi-token, mehrfeldrig und nach Relevanz sortiert.
 * Genutzt von Suchseite und Command-Palette (API).
 */
export async function runCrmSearch(
  rawQuery: string,
  perGroup = 50
): Promise<{ groups: SearchGroup[]; total: number }> {
  const tokens = fold(rawQuery).split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return { groups: [], total: 0 };

  const [accounts, opportunities, candidates, mandates, kiProjects, projectRefs] = await Promise.all([
    getAccounts(),
    getOpportunities(),
    getCandidates(),
    getMandates(),
    getKiProjects(),
    getProjectRefs(),
  ]);

  const accountHits: SearchHit[] = [];
  for (const a of accounts) {
    const score = scoreRecord(tokens, [
      { value: a.name, weight: 3 },
      { value: a.contact_name, weight: 2 },
      { value: a.contact_email, weight: 2 },
      { value: a.contact_phone, weight: 2 },
      { value: a.ort, weight: 2 },
      { value: a.branche, weight: 1 },
      { value: a.segment, weight: 1 },
      { value: a.country, weight: 1 },
    ]);
    if (score > 0)
      accountHits.push({
        href: `/cockpit/kunden/${a.id}`,
        title: a.name,
        subtitle: joinDot(a.branche, a.ort) || a.line,
        meta: joinDot(a.contact_name, a.contact_email, a.contact_phone) || undefined,
        badge: a.lifecycle,
        score,
      });
  }

  const candHits: SearchHit[] = [];
  for (const c of candidates) {
    const score = scoreRecord(tokens, [
      { value: c.name, weight: 3 },
      { value: candNo(c.candidate_no), weight: 3 },
      { value: c.email, weight: 2 },
      { value: c.phone, weight: 2 },
      { value: c.role, weight: 2 },
      { value: c.current_employer, weight: 2 },
      { value: c.mandate_account, weight: 1 },
      { value: c.location, weight: 1 },
      { value: (c.skills ?? []).join(" "), weight: 1 },
      { value: c.source, weight: 1 },
    ]);
    if (score > 0)
      candHits.push({
        href: `/cockpit/kandidaten/${c.id}`,
        title: [c.salutation, c.title, c.name].filter(Boolean).join(" "),
        subtitle: joinDot(c.role, c.current_employer) || c.source,
        meta: joinDot(candNo(c.candidate_no), c.email, c.location) || undefined,
        badge: c.stage,
        score,
      });
  }

  const mandateHits: SearchHit[] = [];
  for (const m of mandates) {
    const score = scoreRecord(tokens, [
      { value: m.account_name, weight: 3 },
      { value: m.role, weight: 3 },
      { value: m.status, weight: 1 },
    ]);
    if (score > 0)
      mandateHits.push({
        href: `/cockpit/projekte/recruiting/${m.id}`,
        title: m.role || "Mandat",
        subtitle: joinDot(m.account_name, m.status),
        score,
        badge: m.status,
      });
  }

  const oppHits: SearchHit[] = [];
  for (const o of opportunities) {
    const score = scoreRecord(tokens, [
      { value: o.account_name, weight: 3 },
      { value: o.title, weight: 2 },
      { value: o.owner, weight: 1 },
    ]);
    if (score > 0)
      oppHits.push({
        href: "/cockpit/sales",
        title: o.title || o.account_name,
        subtitle: joinDot(o.account_name, o.stage),
        score,
        badge: o.stage,
      });
  }

  const kiHits: SearchHit[] = [];
  for (const p of kiProjects) {
    const score = scoreRecord(tokens, [
      { value: p.account_name, weight: 3 },
      { value: p.product, weight: 2 },
      { value: p.segment, weight: 1 },
    ]);
    if (score > 0)
      kiHits.push({
        href: `/cockpit/projekte/ki/${p.id}`,
        title: joinDot(p.product || "KI-Projekt", p.account_name),
        subtitle: joinDot(p.status, p.mrr ? `${p.mrr} €/M` : undefined),
        score,
        badge: p.status,
      });
  }

  const projektHits: SearchHit[] = [];
  for (const p of projectRefs) {
    const score = scoreRecord(tokens, [
      { value: p.titel ?? undefined, weight: 3 },
      { value: p.kunde ?? undefined, weight: 2 },
      { value: p.standort ?? undefined, weight: 1 },
      { value: p.anforderungen ?? undefined, weight: 1 },
    ]);
    if (score > 0)
      projektHits.push({
        href: `/cockpit/match?projekt=${p.id}`,
        title: p.titel ?? "Projekt",
        subtitle: joinDot(p.kunde, p.standort) || "HubSpot-Projekt",
        badge: p.hubspot_stage ?? undefined,
        score,
      });
  }

  const groups: SearchGroup[] = [
    { label: "Projekte (HubSpot)", kind: "projekt", hits: projektHits },
    { label: "Unternehmen", kind: "kunde", hits: accountHits },
    { label: "Kandidaten", kind: "kandidat", hits: candHits },
    { label: "Recruiting-Mandate", kind: "mandat", hits: mandateHits },
    { label: "Verkaufschancen", kind: "chance", hits: oppHits },
    { label: "KI-Projekte", kind: "ki", hits: kiHits },
  ];

  // Nach Relevanz sortieren + pro Gruppe begrenzen.
  let total = 0;
  for (const g of groups) {
    g.hits.sort((x, y) => y.score - x.score || x.title.localeCompare(y.title, "de"));
    total += g.hits.length;
    g.hits = g.hits.slice(0, perGroup);
  }
  return { groups, total };
}
