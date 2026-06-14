import "server-only";
import { createClient } from "@/lib/supabase/server";
import { useMockData } from "@/lib/env";
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
    // Fehlt die Tabelle (Migration noch nicht eingespielt), Mock zeigen.
    if (error) return mock;
    return map((data as Row[] | null) ?? []);
  } catch {
    return mock;
  }
}

const str = (v: unknown, fallback = "") => (v == null ? fallback : String(v));
const num = (v: unknown) => Number(v ?? 0);

export async function getAccounts(): Promise<Account[]> {
  return load(
    "accounts",
    mockAccounts,
    (rows) =>
      rows.map((r) => ({
        id: str(r.id),
        name: str(r.name, "Account"),
        branche: str(r.branche),
        segment: str(r.segment),
        line: (str(r.line, "ki") as BusinessLine),
        lifecycle: (str(r.lifecycle, "lead") as Lifecycle),
        contact_name: str(r.contact_name),
        contact_email: str(r.contact_email),
        mrr: num(r.mrr),
        ort: str(r.ort),
        since: str(r.since),
      })),
    { column: "mrr", ascending: false }
  );
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

export async function getKiProjects(): Promise<KiProject[]> {
  return load(
    "ki_projects",
    mockKiProjects,
    (rows) =>
      rows.map((r) => ({
        id: str(r.id),
        account_name: str(r.account_name, "Account"),
        product: str(r.product),
        segment: str(r.segment),
        status: (str(r.status, "onboarding") as KiStatus),
        mrr: num(r.mrr),
        go_live: str(r.go_live),
        health: (str(r.health, "neutral") as Health),
      })),
    { column: "go_live", ascending: false }
  );
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
      })),
    { column: "deadline", ascending: true }
  );
}

export async function getCandidates(): Promise<Candidate[]> {
  return load(
    "candidates",
    mockCandidates,
    (rows) =>
      rows.map((r) => ({
        id: str(r.id),
        name: str(r.name, "Kandidat:in"),
        role: str(r.role),
        mandate_account: str(r.mandate_account),
        stage: (str(r.stage, "neu") as CandidateStage),
        source: str(r.source),
        updated_at: str(r.updated_at),
      })),
    { column: "updated_at", ascending: false }
  );
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
