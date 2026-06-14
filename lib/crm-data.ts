import "server-only";
import {
  accounts,
  candidates,
  kiProjects,
  mandates,
  opportunities,
  segments,
} from "@/lib/crm-mock";
import type {
  Account,
  Candidate,
  KiProject,
  Opportunity,
  RecruitingMandate,
  Segment,
} from "@/lib/crm-types";

/**
 * Zugriff auf die CRM-Entitäten (Accounts, Opportunities, Projekte, Kandidaten,
 * Segmente). Diese bilden künftige Supabase-Tabellen ab; bis zur entsprechenden
 * Migration liefern sie den Mock-Datensatz. Die Funktionen sind bewusst
 * granular, damit jede Seite nur lädt, was sie braucht, und der Wechsel auf
 * echte Tabellen (RLS-geschützt, ANON-Key) lokal bleibt.
 */

export async function getAccounts(): Promise<Account[]> {
  return accounts;
}

export async function getOpportunities(): Promise<Opportunity[]> {
  return opportunities;
}

export async function getKiProjects(): Promise<KiProject[]> {
  return kiProjects;
}

export async function getMandates(): Promise<RecruitingMandate[]> {
  return mandates;
}

export async function getCandidates(): Promise<Candidate[]> {
  return candidates;
}

export async function getSegments(): Promise<Segment[]> {
  return segments;
}
