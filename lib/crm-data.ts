import "server-only";
import { createClient } from "@/lib/supabase/server";
import { useMockData } from "@/lib/env";
import { logDataError, isMissingTable } from "@/lib/log";
import {
  accounts as mockAccounts,
  candidates as mockCandidates,
  kiProjects as mockKiProjects,
  mandates as mockMandates,
  opportunities as mockOpportunities,
  segments as mockSegments,
} from "@/lib/crm-mock";
import type {
  Account,
  BusinessLine,
  Candidate,
  CandidateStage,
  Health,
  KiProject,
  KiStatus,
  Lifecycle,
  MandateStatus,
  Opportunity,
  RecruitingMandate,
  SalesStage,
  Segment,
} from "@/lib/crm-types";

/**
 * Zugriff auf die CRM-Entitäten (Accounts, Opportunities, Projekte, Kandidaten,
 * Segmente). Bei gesetzter Supabase-ENV wird live gelesen (ANON-Key + Session;
 * RLS scoped auf eigene Daten + Downline). Ohne ENV – oder falls die
 * CRM-Tabellen noch fehlen – greift der Mock-Datensatz, damit Build/Preview
 * funktionieren.
 */
type Row = Record<string, unknown>;

async function load<T>(
  table: string,
  mock: T[],
  map: (rows: Row[]) => T[],
  order?: { column: string; ascending?: boolean }
): Promise<T[]> {
  if (useMockData) return mock;
  try {
    const supabase = createClient();
    let query = supabase.from(table).select("*");
    if (order) query = query.order(order.column, { ascending: order.ascending ?? true });
    const { data, error } = await query;
    if (error) {
      if (isMissingTable(error)) return mock;
      logDataError(`crm-data:${table}`, error);
      return [];
    }
    return map((data as Row[] | null) ?? []);
  } catch (e) {
    logDataError(`crm-data:${table}`, e);
    return [];
  }
}

const str = (v: unknown, fallback = "") => (v == null ? fallback : String(v));
const num = (v: unknown) => Number(v ?? 0);

/** Normalisierter Schlüssel für den namensbasierten Account-Abgleich.
 *  Akzent-/ß-tolerant, damit z.B. „Lagardère" (komponiert/dekomponiert) und
 *  Schreibvarianten denselben Kunden treffen – sonst entstehen Phantom-Dubletten
 *  (abgeleiteter Kunde bleibt trotz echtem Datensatz bestehen). */
export function accountKey(name: string): string {
  return (name ?? "")
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/ß/g, "ss")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function mapAccountRow(r: Row): Account {
  return {
    id: str(r.id),
    name: str(r.name, "Account"),
    branche: str(r.branche),
    segment: str(r.segment),
    line: (str(r.line, "ki") as BusinessLine),
    lifecycle: (str(r.lifecycle, "lead") as Lifecycle),
    contact_name: str(r.contact_name),
    contact_email: str(r.contact_email),
    contact_phone: str(r.contact_phone),
    mrr: num(r.mrr),
    ort: str(r.ort),
    strasse: str(r.strasse) || undefined,
    plz: str(r.plz) || undefined,
    since: str(r.since),
    owner: str(r.owner) || undefined,
    country: str(r.country) || undefined,
    external_id: str(r.external_id) || undefined,
    last_activity_at: str(r.last_activity_at) || undefined,
    engagement_type: (str(r.engagement_type) || undefined) as Account["engagement_type"],
    contract_status: (str(r.contract_status) || undefined) as Account["contract_status"],
    contract_signed_at: str(r.contract_signed_at) || undefined,
    fee_agreement: str(r.fee_agreement) || undefined,
  };
}

/** Präfix für virtuell abgeleitete Accounts (URL-pfadsicher, ohne Doppelpunkt). */
const SYNTH_PREFIX = "ref_";

/** true ⇒ abgeleitete (virtuelle) Account-ID. Akzeptiert auch Alt-Präfix „ref:". */
export function isSyntheticAccountId(id: string): boolean {
  return id.startsWith("ref_") || id.startsWith("ref:");
}

/** Deterministische, umkehrbare ID für einen abgeleiteten Account. */
export function syntheticAccountId(name: string): string {
  return SYNTH_PREFIX + Buffer.from(name.trim(), "utf8").toString("base64url");
}

/** Liest den Namen aus einer abgeleiteten Account-ID zurück (oder null). */
export function nameFromSyntheticId(id: string): string | null {
  if (!isSyntheticAccountId(id)) return null;
  try {
    // Beide Präfixe („ref_" / „ref:") sind 4 Zeichen lang.
    return Buffer.from(id.slice(4), "base64url").toString("utf8");
  } catch {
    return null;
  }
}

function syntheticAccount(name: string, line: BusinessLine): Account {
  return {
    id: syntheticAccountId(name),
    name,
    branche: "",
    segment: "",
    line,
    // Referenziert von Mandat/KI-Projekt/Chance ⇒ es ist ein Kunde.
    lifecycle: "kunde",
    contact_name: "",
    contact_email: "",
    contact_phone: "",
    mrr: 0,
    ort: "",
    since: "",
    synthetic: true,
  };
}

/**
 * Alle Account-Namen, die von anderen Entitäten referenziert werden
 * (Mandate, KI-Projekte, Chancen, Kandidaten) – inkl. abgeleiteter
 * Geschäftslinie. Grundlage für das Self-Healing fehlender Accounts.
 */
async function referencedAccountNames(): Promise<Map<string, { name: string; line: BusinessLine }>> {
  const map = new Map<string, { name: string; line: BusinessLine }>();
  if (useMockData) return map;
  const add = (raw: unknown, line: BusinessLine) => {
    const name = str(raw).trim();
    if (!name) return;
    const key = accountKey(name);
    if (!map.has(key)) map.set(key, { name, line });
  };
  try {
    const supabase = createClient();
    const [m, k, o, c] = await Promise.all([
      supabase.from("recruiting_mandates").select("account_name"),
      supabase.from("ki_projects").select("account_name"),
      supabase.from("opportunities").select("account_name, line"),
      supabase.from("candidates").select("mandate_account"),
    ]);
    for (const r of (m.data as Row[] | null) ?? []) add(r.account_name, "recruiting");
    for (const r of (k.data as Row[] | null) ?? []) add(r.account_name, "ki");
    for (const r of (o.data as Row[] | null) ?? []) add(r.account_name, str(r.line, "ki") as BusinessLine);
    for (const r of (c.data as Row[] | null) ?? []) add(r.mandate_account, "recruiting");
  } catch (e) {
    // Self-Healing ist best effort – nie die Account-Liste blockieren.
    logDataError("crm-data:referencedAccountNames", e);
  }
  return map;
}

export async function getAccounts(): Promise<Account[]> {
  const real = await load(
    "accounts",
    mockAccounts,
    (rows) => rows.map(mapAccountRow),
    { column: "mrr", ascending: false }
  );
  if (useMockData) return real;

  // Self-Healing: Jeder Account-Name, der von einem Mandat, KI-Projekt, einer
  // Chance oder einem Kandidaten referenziert wird, MUSS als Kunde auffindbar
  // sein – auch wenn (noch) kein eigener accounts-Datensatz existiert (z.B.
  // Altbestand/Import). Solche Namen werden als virtuelle Accounts ergänzt und
  // beim ersten Schreibzugriff (Aktivität/Notiz/Backfill) materialisiert.
  const refs = await referencedAccountNames();
  if (refs.size === 0) return real;
  const have = new Set(real.map((a) => accountKey(a.name)));
  const synthetic: Account[] = [];
  for (const { name, line } of refs.values()) {
    const key = accountKey(name);
    if (!key || have.has(key)) continue;
    have.add(key);
    synthetic.push(syntheticAccount(name, line));
  }
  synthetic.sort((a, b) => a.name.localeCompare(b.name, "de"));
  return [...real, ...synthetic];
}

export async function getOpportunities(): Promise<Opportunity[]> {
  return load(
    "opportunities",
    mockOpportunities,
    (rows) =>
      rows.map((r) => ({
        id: str(r.id),
        account_name: str(r.account_name, "Account"),
        line: (str(r.line, "ki") as BusinessLine),
        title: str(r.title),
        value: num(r.value),
        value_type: (str(r.value_type, "mrr") as Opportunity["value_type"]),
        stage: (str(r.stage, "neu") as SalesStage),
        probability: num(r.probability),
        owner: str(r.owner),
        expected_close: str(r.expected_close),
      })),
    { column: "expected_close", ascending: true }
  );
}

function mapKiProject(r: Row): KiProject {
  return {
    id: str(r.id),
    account_name: str(r.account_name, "Account"),
    product: str(r.product),
    segment: str(r.segment),
    status: (str(r.status, "onboarding") as KiStatus),
    mrr: num(r.mrr),
    setup_fee: num(r.setup_fee),
    go_live: str(r.go_live),
    health: (str(r.health, "neutral") as Health),
    use_case: str(r.use_case) || undefined,
    project_manager: str(r.project_manager) || undefined,
    kickoff_date: str(r.kickoff_date) || undefined,
    decision_maker: str(r.decision_maker) || undefined,
    tech_contact: str(r.tech_contact) || undefined,
    contract_start: str(r.contract_start) || undefined,
    contract_end: str(r.contract_end) || undefined,
    term_months: r.term_months == null ? undefined : Number(r.term_months),
    billing_cycle: str(r.billing_cycle) || undefined,
    auto_renew: r.auto_renew == null ? undefined : Boolean(r.auto_renew),
    churn_risk: (str(r.churn_risk) || undefined) as KiProject["churn_risk"],
    nps: r.nps == null ? undefined : Number(r.nps),
    upsell_potential: str(r.upsell_potential) || undefined,
    upsell_value: r.upsell_value == null ? undefined : Number(r.upsell_value),
    created_at: str(r.created_at) || undefined,
  };
}

export async function getKiProjects(): Promise<KiProject[]> {
  return load("ki_projects", mockKiProjects, (rows) => rows.map(mapKiProject), {
    column: "go_live",
    ascending: false,
  });
}

/** Einzelnes KI-Projekt für das Cockpit (RLS-scoped). */
export async function getKiProject(id: string): Promise<KiProject | null> {
  if (useMockData) return mockKiProjects.find((p) => p.id === id) ?? null;
  try {
    const supabase = createClient();
    const { data, error } = await supabase.from("ki_projects").select("*").eq("id", id).maybeSingle();
    if (error || !data) return null;
    return mapKiProject(data as Row);
  } catch {
    return null;
  }
}

export async function getMandates(): Promise<RecruitingMandate[]> {
  return load(
    "recruiting_mandates",
    mockMandates,
    (rows) =>
      rows.map((r) => ({
        id: str(r.id),
        account_name: str(r.account_name, "Account"),
        role: str(r.role),
        positions: num(r.positions),
        filled: num(r.filled),
        status: (str(r.status, "offen") as MandateStatus),
        fee: num(r.fee),
        candidate_count: num(r.candidate_count),
        deadline: str(r.deadline),
        pricing_model: (str(r.pricing_model, "fixed") as "fixed" | "percent"),
        target_salary: r.target_salary != null ? Number(r.target_salary) : undefined,
        fee_percent: r.fee_percent != null ? Number(r.fee_percent) : undefined,
        deposit: r.deposit != null ? Number(r.deposit) : undefined,
        split_payment: r.split_payment == null ? undefined : Boolean(r.split_payment),
        job_posting: str(r.job_posting) || undefined,
        job_posting_anonymized: str(r.job_posting_anonymized) || undefined,
        share_token: str(r.share_token) || undefined,
        created_at: str(r.created_at) || undefined,
        deposit_paid: r.deposit_paid == null ? undefined : Boolean(r.deposit_paid),
        deposit_paid_at: str(r.deposit_paid_at) || undefined,
        final_paid: r.final_paid == null ? undefined : Boolean(r.final_paid),
        final_paid_at: str(r.final_paid_at) || undefined,
      })),
    { column: "deadline", ascending: true }
  );
}

function mapCandidate(r: Row): Candidate {
  return {
    id: str(r.id),
    name: str(r.name, "Kandidat:in"),
    role: str(r.role),
    mandate_account: str(r.mandate_account),
    mandate_id: str(r.mandate_id) || undefined,
    stage: (str(r.stage, "neu") as CandidateStage),
    source: str(r.source),
    updated_at: str(r.updated_at),
    candidate_no: r.candidate_no != null ? Number(r.candidate_no) : undefined,
    photo_path: str(r.photo_path) || undefined,
    salutation: str(r.salutation) || undefined,
    title: str(r.title) || undefined,
    email: str(r.email),
    phone: str(r.phone),
    cv_path: str(r.cv_path),
    cv_filename: str(r.cv_filename),
    cv_uploaded_at: str(r.cv_uploaded_at),
    skills: Array.isArray(r.skills)
      ? (r.skills as unknown[]).map((s) => String(s)).filter(Boolean)
      : [],
    rating: r.rating != null ? Number(r.rating) : undefined,
    tags: Array.isArray(r.tags)
      ? (r.tags as unknown[]).map((t) => String(t)).filter(Boolean)
      : [],
    location: str(r.location) || undefined,
    zip: str(r.zip) || undefined,
    willing_to_relocate: r.willing_to_relocate == null ? undefined : Boolean(r.willing_to_relocate),
    travel_willingness: str(r.travel_willingness) || undefined,
    salary_expectation: r.salary_expectation != null ? Number(r.salary_expectation) : undefined,
    availability: str(r.availability) || undefined,
    birth_date: str(r.birth_date) || undefined,
    current_employer: str(r.current_employer) || undefined,
    languages: str(r.languages) || undefined,
    experience_years: r.experience_years != null ? Number(r.experience_years) : undefined,
  };
}

export async function getCandidates(): Promise<Candidate[]> {
  return load("candidates", mockCandidates, (rows) => rows.map(mapCandidate), {
    column: "updated_at",
    ascending: false,
  });
}

/** Einzelne:r Kandidat:in für die Detailmaske (RLS-scoped). */
export async function getCandidate(id: string): Promise<Candidate | null> {
  if (useMockData) return mockCandidates.find((c) => c.id === id) ?? null;
  try {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("candidates")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (error) {
      if (!isMissingTable(error)) logDataError("crm-data:candidate", error);
      return null;
    }
    return data ? mapCandidate(data as Row) : null;
  } catch (e) {
    logDataError("crm-data:candidate", e);
    return null;
  }
}

export async function getSegments(): Promise<Segment[]> {
  return load("v_segments", mockSegments, (rows) =>
    rows.map((r) => ({
      id: str(r.id),
      name: str(r.name, "Segment"),
      description: str(r.description),
      accounts: num(r.accounts),
      mrr: num(r.mrr),
      top_product: str(r.top_product),
    }))
  );
}

export interface AccountDetail {
  account: Account;
  opportunities: Opportunity[];
  kiProjects: KiProject[];
  mandates: RecruitingMandate[];
  candidates: Candidate[];
}

/**
 * Account inkl. verknüpfter Datensätze (Chancen, KI-Projekte, Mandate,
 * Kandidaten) – verbunden über den Account-Namen.
 */
export async function getAccountDetail(id: string): Promise<AccountDetail | null> {
  const [accounts, opportunities, kiProjects, mandates, candidates] =
    await Promise.all([
      getAccounts(),
      getOpportunities(),
      getKiProjects(),
      getMandates(),
      getCandidates(),
    ]);

  // Abgeleitete (virtuelle) ID: bevorzugt einen ECHTEN Datensatz mit gleichem
  // Namen (falls der Kunde inzwischen materialisiert wurde) – sonst die
  // synthetische Karte. Verhindert, dass nach dem Speichern weiter die leere
  // abgeleitete Version statt der echten (mit Daten) angezeigt wird.
  let account: Account | undefined;
  if (isSyntheticAccountId(id)) {
    const refName = nameFromSyntheticId(id);
    const key = refName ? accountKey(refName) : "";
    account =
      (key ? accounts.find((a) => !a.synthetic && accountKey(a.name) === key) : undefined) ??
      accounts.find((a) => a.id === id) ??
      (key ? accounts.find((a) => accountKey(a.name) === key) : undefined);
  } else {
    account = accounts.find((a) => a.id === id);
  }
  if (!account) return null;
  const key = accountKey(account.name);
  const eq = (v: string) => accountKey(v) === key;

  return {
    account,
    opportunities: opportunities.filter((o) => eq(o.account_name)),
    kiProjects: kiProjects.filter((p) => eq(p.account_name)),
    mandates: mandates.filter((m) => eq(m.account_name)),
    candidates: candidates.filter((c) => eq(c.mandate_account)),
  };
}
