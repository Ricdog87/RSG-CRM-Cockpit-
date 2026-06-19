"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/Badge";
import { IconPlus, IconTrash, IconCheck, IconBolt, IconCopy } from "@/components/ui/icons";
import { formatDate, formatEur } from "@/lib/format";
import {
  createInvoice,
  generateInvoicesFromPlacement,
  setInvoiceStatus,
  deleteInvoice,
} from "@/lib/invoices-actions";
import { buildInvoiceHtml } from "@/lib/invoice-template";
import { invoiceOverdue, type Invoice, type InvoiceStatus } from "@/lib/crm-types";

/** Adress-/Kontaktdaten des Kunden für das Rechnungsdokument. */
export interface InvoiceCustomer {
  street?: string;
  zip?: string;
  city?: string;
  contactName?: string;
}

const input =
  "w-full rounded-lg border border-border bg-surface px-2.5 py-1.5 text-sm text-ink placeholder:text-faint focus-visible:ring-2 focus-visible:ring-brand";

const statusMeta: Record<InvoiceStatus, { label: string; tone: "neutral" | "sky" | "success" }> = {
  entwurf: { label: "Entwurf", tone: "neutral" },
  gestellt: { label: "Gestellt", tone: "sky" },
  bezahlt: { label: "Bezahlt", tone: "success" },
};

export function InvoicesCard({
  mandateId,
  accountName,
  invoices,
  placements,
  customer,
}: {
  mandateId: string;
  accountName: string;
  invoices: Invoice[];
  /** Platzierungen ohne erzeugte Rechnungen → „aus Plan erzeugen". */
  placements: { id: string; label: string }[];
  /** Kunden-Adresse für das gebrandete Rechnungsdokument. */
  customer?: InvoiceCustomer;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [label, setLabel] = useState("");
  const [amount, setAmount] = useState<number>(0);
  const [due, setDue] = useState("");

  const total = invoices.reduce((s, i) => s + i.amount, 0);
  const open_ = invoices.filter((i) => i.status === "gestellt").reduce((s, i) => s + i.amount, 0);

  function gen(placementId: string) {
    setError(null);
    start(async () => {
      const res = await generateInvoicesFromPlacement(placementId);
      if (!res.ok) return setError(res.error ?? "Erzeugen fehlgeschlagen.");
      if (!res.demo) router.refresh();
    });
  }
  function addManual() {
    setError(null);
    start(async () => {
      const res = await createInvoice({
        mandate_id: mandateId,
        account_name: accountName,
        label: label || "Honorar",
        amount,
        due_date: due || null,
        status: "entwurf",
      });
      if (!res.ok) return setError(res.error ?? "Speichern fehlgeschlagen.");
      setOpen(false); setLabel(""); setAmount(0); setDue("");
      if (!res.demo) router.refresh();
    });
  }
  function setStat(id: string, s: InvoiceStatus) {
    start(async () => {
      const res = await setInvoiceStatus(id, s, mandateId);
      if (res.ok && !res.demo) router.refresh();
    });
  }
  function remove(id: string) {
    start(async () => {
      const res = await deleteInvoice(id, mandateId);
      if (res.ok && !res.demo) router.refresh();
    });
  }
  function printInvoice(inv: Invoice) {
    const html = buildInvoiceHtml({
      invoiceNo: inv.invoice_no,
      issueDate: inv.issue_date,
      dueDate: inv.due_date,
      customerName: accountName,
      customerStreet: customer?.street,
      customerZip: customer?.zip,
      customerCity: customer?.city,
      contactName: customer?.contactName,
      role: inv.role,
      label: inv.label,
      amount: inv.amount,
    });
    const w = window.open("", "_blank", "width=820,height=900");
    if (!w) return;
    w.document.open();
    w.document.write(html);
    w.document.close();
  }

  return (
    <div className="space-y-3">
      {invoices.length > 0 ? (
        <div className="flex items-center justify-between rounded-xl border border-border bg-elevated/40 px-3 py-2 text-xs">
          <span className="text-muted">Gesamt <span className="font-semibold text-ink">{formatEur(total)}</span></span>
          <span className="text-muted">Offen <span className="font-semibold text-sky-deep">{formatEur(open_)}</span></span>
        </div>
      ) : null}

      {invoices.length === 0 ? (
        <p className="text-sm text-muted">Noch keine Rechnungen. Erzeuge sie aus einer Platzierung (Zahlungsplan) oder lege sie manuell an.</p>
      ) : (
        <ul className="space-y-2">
          {invoices.map((inv) => {
            const sm = statusMeta[inv.status];
            const over = invoiceOverdue(inv);
            return (
              <li key={inv.id} className="rounded-xl border border-border bg-elevated/40 p-2.5">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-ink">{inv.label || "Honorar"}</p>
                    <p className="truncate text-xs text-faint">
                      {formatEur(inv.amount)}
                      {inv.due_date ? ` · fällig ${formatDate(inv.due_date)}` : ""}
                      {inv.paid_date ? ` · bezahlt ${formatDate(inv.paid_date)}` : ""}
                    </p>
                  </div>
                  {over ? <Badge tone="danger">Überfällig</Badge> : <Badge tone={sm.tone}>{sm.label}</Badge>}
                </div>
                <div className="mt-1.5 flex items-center justify-between gap-2">
                  <select value={inv.status} onChange={(e) => setStat(inv.id, e.target.value as InvoiceStatus)} disabled={pending}
                    className="rounded-lg border border-border bg-surface px-2 py-1 text-xs text-ink">
                    {(Object.keys(statusMeta) as InvoiceStatus[]).map((s) => (
                      <option key={s} value={s}>{statusMeta[s].label}</option>
                    ))}
                  </select>
                  <div className="flex items-center gap-1">
                    <button type="button" onClick={() => printInvoice(inv)}
                      className="inline-flex items-center gap-1 rounded-lg border border-border bg-surface px-2 py-1 text-xs font-medium text-ink hover:border-brand/40"
                      title="Rechnung als PDF (mit RSG-Logo)">
                      <IconCopy size={12} /> PDF
                    </button>
                    <button type="button" aria-label="löschen" onClick={() => remove(inv.id)} disabled={pending}
                      className="rounded-lg p-1.5 text-faint hover:bg-danger/10 hover:text-danger">
                      <IconTrash size={13} />
                    </button>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {error ? <p className="text-xs text-danger">{error}</p> : null}

      {/* Aus Platzierung erzeugen */}
      {placements.length > 0 ? (
        <div className="space-y-1.5">
          {placements.map((pl) => (
            <button key={pl.id} type="button" onClick={() => gen(pl.id)} disabled={pending}
              className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-brand/30 bg-brand/10 px-2.5 py-1.5 text-xs font-semibold text-brand-deep hover:bg-brand/15 disabled:opacity-60">
              <IconBolt size={13} /> Rechnungen erzeugen: {pl.label}
            </button>
          ))}
        </div>
      ) : null}

      {/* Manuell */}
      {open ? (
        <div className="space-y-2 rounded-xl border border-border bg-surface p-3">
          <input placeholder="Bezeichnung (z.B. Honorar)" value={label} onChange={(e) => setLabel(e.target.value)} className={input} />
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="mb-1 block text-[0.7rem] font-medium text-muted">Betrag (€)</label>
              <input type="number" min={0} value={amount} onChange={(e) => setAmount(Number(e.target.value) || 0)} className={input} />
            </div>
            <div>
              <label className="mb-1 block text-[0.7rem] font-medium text-muted">Fällig am</label>
              <input type="date" value={due} onChange={(e) => setDue(e.target.value)} className={input} />
            </div>
          </div>
          <div className="flex items-center justify-end gap-2">
            <button type="button" onClick={() => setOpen(false)} className="rounded-lg px-2.5 py-1 text-xs text-muted hover:text-ink">Abbrechen</button>
            <button type="button" onClick={addManual} disabled={pending}
              className="inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-brand to-sky px-3 py-1.5 text-xs font-semibold text-white shadow-glow disabled:opacity-60">
              <IconCheck size={12} /> {pending ? "…" : "Speichern"}
            </button>
          </div>
        </div>
      ) : (
        <button type="button" onClick={() => setOpen(true)}
          className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-elevated px-2.5 py-1.5 text-xs font-medium text-ink hover:border-brand/40">
          <IconPlus size={13} /> Rechnung manuell
        </button>
      )}
    </div>
  );
}
