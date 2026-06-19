"use client";

import { useState } from "react";
import { Dialog } from "@/components/ui/Dialog";
import { IconBriefcase, IconCheck, IconAlertTriangle } from "@/components/ui/icons";
import { cn } from "@/components/ui/cn";
import { buildPlacementContractHtml, type ContractType } from "@/lib/contract-template";
import { recordContractCreated } from "@/lib/crm-actions";
import { formatEur } from "@/lib/format";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import type { Account } from "@/lib/crm-types";

const inputCls =
  "w-full rounded-lg border border-border bg-surface px-2.5 py-1.5 text-sm text-ink placeholder:text-faint focus-visible:ring-2 focus-visible:ring-brand";

/**
 * Erstellt per Klick einen Personalvermittlungsvertrag aus den Kundendaten.
 * Zwei Modelle: Festpreis oder % vom Jahresbruttozielgehalt (mit/ohne Splittung).
 */
export interface ContractPrefill {
  type?: ContractType;
  role?: string;
  fee?: number;
  deposit?: number;
  percent?: number;
  split?: boolean;
}

export function PlacementContractDialog({
  account,
  prefill,
  label = "Vermittlungsvertrag erstellen",
}: {
  account: Account;
  prefill?: ContractPrefill;
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<ContractType>(prefill?.type ?? "fixed");
  const [role, setRole] = useState(prefill?.role ?? "");
  const [fee, setFee] = useState(prefill?.fee ?? 9999);
  const [deposit, setDeposit] = useState(prefill?.deposit ?? 2500);
  const [percent, setPercent] = useState(prefill?.percent ?? 25);
  const [split, setSplit] = useState(prefill?.split ?? true);

  const router = useRouter();
  const [logging, startLog] = useTransition();
  const [logged, setLogged] = useState(false);
  const hasAddress = Boolean((account.strasse || account.plz || account.ort)?.toString().trim());

  function summaryText(): string {
    if (type === "fixed") {
      const rest = Math.max(0, fee - deposit);
      return `Vermittlungsvertrag erstellt (Festpreis) – ${role.trim() || "Position"}: Honorar ${formatEur(fee)}, Anzahlung ${formatEur(deposit)}, Rest ${formatEur(rest)} bei Besetzung.`;
    }
    return `Vermittlungsvertrag erstellt (${percent}% vom Jahresbruttozielgehalt${split ? ", 50/50-Splittung" : ""}) – ${role.trim() || "Position"}.`;
  }

  function generate() {
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    const html = buildPlacementContractHtml({
      type,
      customerName: account.name,
      customerStreet: account.strasse,
      customerZip: account.plz,
      customerCity: account.ort,
      contactName: account.contact_name || undefined,
      role: role.trim() || undefined,
      fee,
      deposit,
      percent,
      split,
      logoUrl: `${origin}/contract/rsg-logo.png`,
      signatureUrl: `${origin}/contract/rsg-signature.png`,
    });
    const w = window.open("", "_blank", "width=860,height=960");
    if (w) {
      w.document.open();
      w.document.write(html);
      w.document.close();
    }
    // Beim Kunden als Korrespondenz festhalten + Status „versendet“.
    startLog(async () => {
      const res = await recordContractCreated(account.id, summaryText());
      if (res.ok) {
        setLogged(true);
        if (!res.demo) router.refresh();
      }
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 rounded-lg border border-brand/40 bg-brand/10 px-3 py-1.5 text-sm font-semibold text-brand-deep transition-colors hover:bg-brand/15"
      >
        <IconBriefcase size={14} /> {label}
      </button>

      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title="Personalvermittlungsvertrag"
        description="Daten aus der Kundenmaske · Logo + RSG-Unterschrift bereits enthalten."
      >
        <div className="space-y-4">
          {/* Kundendaten-Vorschau */}
          <div className="rounded-xl border border-border bg-elevated/40 p-3 text-sm">
            <p className="font-semibold text-ink">{account.name}</p>
            <p className="text-xs text-muted">
              {[account.strasse, [account.plz, account.ort].filter(Boolean).join(" ")].filter(Boolean).join(", ") || "—"}
              {account.contact_name ? ` · z.Hd. ${account.contact_name}` : ""}
            </p>
            {!hasAddress ? (
              <p className="mt-1.5 inline-flex items-center gap-1 text-[0.7rem] text-warning">
                <IconAlertTriangle size={11} /> Keine Adresse hinterlegt – oben über das Stift-Symbol „Kunde bearbeiten“ ergänzen.
              </p>
            ) : null}
          </div>

          {/* Modellwahl */}
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setType("fixed")}
              className={cn(
                "rounded-xl border px-3 py-2 text-left text-sm transition-colors",
                type === "fixed" ? "border-brand bg-brand/10 text-brand-deep" : "border-border bg-surface text-muted hover:border-brand/40"
              )}
            >
              <span className="flex items-center gap-1.5 font-semibold">
                {type === "fixed" ? <IconCheck size={13} /> : null} Festpreis
              </span>
              <span className="mt-0.5 block text-[0.7rem]">Fixes Honorar je Vermittlung + Anzahlung</span>
            </button>
            <button
              type="button"
              onClick={() => setType("percent")}
              className={cn(
                "rounded-xl border px-3 py-2 text-left text-sm transition-colors",
                type === "percent" ? "border-brand bg-brand/10 text-brand-deep" : "border-border bg-surface text-muted hover:border-brand/40"
              )}
            >
              <span className="flex items-center gap-1.5 font-semibold">
                {type === "percent" ? <IconCheck size={13} /> : null} % vom Zielgehalt
              </span>
              <span className="mt-0.5 block text-[0.7rem]">% des Jahresbruttozielgehalts</span>
            </button>
          </div>

          {/* Position */}
          <label className="block">
            <span className="kpi-label">Position / Rolle</span>
            <input
              value={role}
              onChange={(e) => setRole(e.target.value)}
              placeholder="z.B. Regional Manager (m/w/d)"
              className={cn(inputCls, "mt-1")}
            />
          </label>

          {/* Modell-spezifische Felder */}
          {type === "fixed" ? (
            <div className="grid grid-cols-2 gap-2">
              <label className="block">
                <span className="kpi-label">Honorar netto (€)</span>
                <input type="number" min={0} value={fee} onChange={(e) => setFee(Number(e.target.value))} className={cn(inputCls, "mt-1")} />
              </label>
              <label className="block">
                <span className="kpi-label">Anzahlung netto (€)</span>
                <input type="number" min={0} value={deposit} onChange={(e) => setDeposit(Number(e.target.value))} className={cn(inputCls, "mt-1")} />
              </label>
            </div>
          ) : (
            <div className="space-y-2">
              <label className="block">
                <span className="kpi-label">Honorarsatz (%)</span>
                <input type="number" min={0} max={100} value={percent} onChange={(e) => setPercent(Number(e.target.value))} className={cn(inputCls, "mt-1")} />
              </label>
              <label className="flex items-center gap-2 text-sm text-ink">
                <input type="checkbox" checked={split} onChange={(e) => setSplit(e.target.checked)} className="h-4 w-4 rounded border-border" />
                50/50-Splittung (50 % bei Unterzeichnung, 50 % nach 3 Monaten) – wie bei Lagardère
              </label>
            </div>
          )}

          {logged ? (
            <p className="flex items-center gap-1.5 rounded-lg border border-success/30 bg-success/[0.06] px-3 py-2 text-xs text-success">
              <IconCheck size={13} className="flex-none" /> Beim Kunden als Korrespondenz hinterlegt · Vertragsstatus „versendet“ gesetzt.
            </p>
          ) : null}

          <div className="flex items-center justify-end gap-2 border-t border-border pt-3">
            <button type="button" onClick={() => setOpen(false)} className="rounded-lg border border-border bg-elevated px-3 py-1.5 text-sm text-muted hover:text-ink">
              {logged ? "Schließen" : "Abbrechen"}
            </button>
            <button
              type="button"
              onClick={generate}
              disabled={logging}
              className="inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-brand to-sky px-4 py-1.5 text-sm font-semibold text-white shadow-glow active:scale-95 disabled:opacity-60"
            >
              <IconBriefcase size={14} /> {logging ? "Erstelle …" : logged ? "Erneut erstellen" : "Vertrag erstellen"}
            </button>
          </div>
        </div>
      </Dialog>
    </>
  );
}
