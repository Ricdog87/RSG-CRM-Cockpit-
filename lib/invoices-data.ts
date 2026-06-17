import "server-only";
import { createClient } from "@/lib/supabase/server";
import { useMockData } from "@/lib/env";
import { invoiceOverdue, type Invoice, type InvoiceStatus } from "@/lib/crm-types";

type Row = Record<string, unknown>;
const str = (v: unknown): string => (v == null ? "" : String(v));
const num = (v: unknown): number => (v == null ? 0 : Number(v));

function mapInvoice(r: Row): Invoice {
  return {
    id: str(r.id),
    mandate_id: str(r.mandate_id) || undefined,
    placement_id: str(r.placement_id) || undefined,
    account_name: str(r.account_name),
    role: str(r.role) || undefined,
    label: str(r.label) || undefined,
    amount: num(r.amount),
    issue_date: str(r.issue_date) || undefined,
    due_date: str(r.due_date) || undefined,
    paid_date: str(r.paid_date) || undefined,
    invoice_no: str(r.invoice_no) || undefined,
    status: (str(r.status) || "entwurf") as InvoiceStatus,
    notes: str(r.notes) || undefined,
    created_at: str(r.created_at) || undefined,
  };
}

export async function getInvoices(): Promise<Invoice[]> {
  if (useMockData) return [];
  try {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("invoices")
      .select("*")
      .order("due_date", { ascending: true });
    if (error || !data) return [];
    return (data as Row[]).map(mapInvoice);
  } catch {
    return [];
  }
}

export async function getInvoicesForMandate(mandateId: string): Promise<Invoice[]> {
  if (useMockData) return [];
  try {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("invoices")
      .select("*")
      .eq("mandate_id", mandateId)
      .order("due_date", { ascending: true });
    if (error || !data) return [];
    return (data as Row[]).map(mapInvoice);
  } catch {
    return [];
  }
}

export interface InvoiceSummary {
  outstanding: number; // gestellt, noch nicht bezahlt
  overdue: number; // davon überfällig
  paidThisMonth: number;
  draft: number; // Entwürfe (noch nicht gestellt)
}

export async function getInvoiceSummary(): Promise<InvoiceSummary> {
  const invoices = await getInvoices();
  const ym = new Date().toISOString().slice(0, 7);
  let outstanding = 0,
    overdue = 0,
    paidThisMonth = 0,
    draft = 0;
  for (const inv of invoices) {
    if (inv.status === "gestellt") {
      outstanding += inv.amount;
      if (invoiceOverdue(inv)) overdue += inv.amount;
    } else if (inv.status === "bezahlt") {
      if ((inv.paid_date ?? "").startsWith(ym)) paidThisMonth += inv.amount;
    } else if (inv.status === "entwurf") {
      draft += inv.amount;
    }
  }
  return { outstanding, overdue, paidThisMonth, draft };
}
