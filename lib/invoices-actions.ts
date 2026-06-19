"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { useMockData } from "@/lib/env";
import type { ActionResult } from "@/lib/crm-actions";
import type { InvoiceStatus } from "@/lib/crm-types";

const DEMO: ActionResult = { ok: true, demo: true };

async function currentPartnerId(): Promise<{ id: string | null; error?: string }> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { id: null, error: "Keine aktive Session." };
  const { data, error } = await supabase
    .from("partners")
    .select("id")
    .eq("auth_user_id", user.id)
    .single();
  if (error || !data) return { id: null, error: "Kein Partner-Profil gefunden." };
  return { id: data.id as string };
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}
function addDays(iso: string, days: number): string {
  const d = new Date(iso + "T00:00:00");
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}
function addMonths(iso: string, months: number): string {
  const d = new Date(iso + "T00:00:00");
  const day = d.getDate();
  d.setMonth(d.getMonth() + months);
  if (d.getDate() < day) d.setDate(0);
  return d.toISOString().slice(0, 10);
}

export interface InvoiceInput {
  mandate_id?: string | null;
  placement_id?: string | null;
  account_name?: string;
  role?: string;
  label?: string;
  amount: number;
  issue_date?: string | null;
  due_date?: string | null;
  invoice_no?: string | null;
  status?: InvoiceStatus;
}

function missingTable(msg: string): boolean {
  return /relation .*invoices.* does not exist/i.test(msg);
}

export async function createInvoice(input: InvoiceInput): Promise<ActionResult> {
  if (useMockData) return DEMO;
  const { id: pid, error } = await currentPartnerId();
  if (!pid) return { ok: false, error };
  const supabase = createClient();
  const { error: insErr } = await supabase.from("invoices").insert({
    partner_id: pid,
    mandate_id: input.mandate_id || null,
    placement_id: input.placement_id || null,
    account_name: input.account_name || null,
    role: input.role || null,
    label: input.label || null,
    amount: input.amount ?? 0,
    issue_date: input.issue_date || null,
    due_date: input.due_date || null,
    invoice_no: input.invoice_no || null,
    status: input.status || "entwurf",
  });
  if (insErr) {
    if (missingTable(insErr.message))
      return { ok: false, error: "Tabelle invoices fehlt – Migration 15_invoices.sql ausführen." };
    return { ok: false, error: insErr.message };
  }
  if (input.mandate_id) revalidatePath(`/cockpit/projekte/recruiting/${input.mandate_id}`);
  revalidatePath("/cockpit");
  return { ok: true };
}

/**
 * Erzeugt Rechnungs-Positionen aus dem Zahlungsplan einer Platzierung:
 * Anzahlung (fällig +14 T), dann Erfolgshonorar – ggf. 50/50 (Unterzeichnung /
 * 3 Monate). Überspringt, wenn für die Platzierung bereits Rechnungen bestehen.
 */
export async function generateInvoicesFromPlacement(placementId: string): Promise<ActionResult> {
  if (useMockData) return DEMO;
  const { id: pid, error } = await currentPartnerId();
  if (!pid) return { ok: false, error };
  const supabase = createClient();

  const { data: pRow, error: pErr } = await supabase
    .from("placements")
    .select("id, mandate_id, account_name, role, start_date, agreed_fee")
    .eq("id", placementId)
    .maybeSingle();
  if (pErr || !pRow) return { ok: false, error: "Platzierung nicht gefunden." };
  const p = pRow as {
    id: string;
    mandate_id?: string;
    account_name?: string;
    role?: string;
    start_date?: string;
    agreed_fee?: number;
  };

  const { count } = await supabase
    .from("invoices")
    .select("id", { count: "exact", head: true })
    .eq("placement_id", placementId);
  if ((count ?? 0) > 0) return { ok: false, error: "Für diese Platzierung gibt es bereits Rechnungen." };

  let deposit = 0;
  let split = false;
  if (p.mandate_id) {
    const { data: m } = await supabase
      .from("recruiting_mandates")
      .select("deposit, split_payment")
      .eq("id", p.mandate_id)
      .maybeSingle();
    const md = m as { deposit?: number; split_payment?: boolean } | null;
    deposit = Math.max(0, Number(md?.deposit ?? 0));
    split = Boolean(md?.split_payment);
  }

  const total = Math.max(0, Number(p.agreed_fee ?? 0));
  const start = p.start_date || today();
  deposit = Math.min(deposit, total);
  const success = total - deposit;

  const rows: { label: string; amount: number; issue_date: string; due_date: string }[] = [];
  if (deposit > 0) {
    rows.push({ label: "Anzahlung", amount: deposit, issue_date: today(), due_date: addDays(today(), 14) });
  }
  if (success > 0) {
    if (split) {
      const first = Math.round(success / 2);
      rows.push({ label: "1. Rate (Vertragsunterzeichnung)", amount: first, issue_date: start, due_date: addDays(start, 14) });
      const milestone = addMonths(start, 3);
      rows.push({ label: "2. Rate (3 Monate Betriebszugehörigkeit)", amount: success - first, issue_date: milestone, due_date: addDays(milestone, 14) });
    } else {
      rows.push({ label: "Honorar (erfolgreiche Vermittlung)", amount: success, issue_date: start, due_date: addDays(start, 14) });
    }
  }
  if (rows.length === 0) return { ok: false, error: "Kein Honorar hinterlegt – Platzierung prüfen." };

  const { error: insErr } = await supabase.from("invoices").insert(
    rows.map((r) => ({
      partner_id: pid,
      mandate_id: p.mandate_id || null,
      placement_id: p.id,
      account_name: p.account_name || null,
      role: p.role || null,
      ...r,
      status: "entwurf" as InvoiceStatus,
    }))
  );
  if (insErr) {
    if (missingTable(insErr.message))
      return { ok: false, error: "Tabelle invoices fehlt – Migration 15_invoices.sql ausführen." };
    return { ok: false, error: insErr.message };
  }
  if (p.mandate_id) revalidatePath(`/cockpit/projekte/recruiting/${p.mandate_id}`);
  revalidatePath("/cockpit");
  return { ok: true };
}

export async function setInvoiceStatus(
  id: string,
  status: InvoiceStatus,
  mandateId?: string
): Promise<ActionResult> {
  if (useMockData) return DEMO;
  const { id: pid, error: pidErr } = await currentPartnerId();
  if (!pid) return { ok: false, error: pidErr };
  const supabase = createClient();
  const patch: Record<string, unknown> = { status };
  patch.paid_date = status === "bezahlt" ? today() : null;
  const { error } = await supabase.from("invoices").update(patch).eq("id", id).eq("partner_id", pid);
  if (error) return { ok: false, error: error.message };
  if (mandateId) revalidatePath(`/cockpit/projekte/recruiting/${mandateId}`);
  revalidatePath("/cockpit");
  return { ok: true };
}

export async function deleteInvoice(id: string, mandateId?: string): Promise<ActionResult> {
  if (useMockData) return DEMO;
  const { id: pid, error: pidErr } = await currentPartnerId();
  if (!pid) return { ok: false, error: pidErr };
  const supabase = createClient();
  const { error } = await supabase.from("invoices").delete().eq("id", id).eq("partner_id", pid);
  if (error) return { ok: false, error: error.message };
  if (mandateId) revalidatePath(`/cockpit/projekte/recruiting/${mandateId}`);
  revalidatePath("/cockpit");
  return { ok: true };
}
