"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Card, CardBody, SectionHeader } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { IconCheck, IconEuro, IconSearch } from "@/components/ui/icons";
import { cn } from "@/components/ui/cn";
import { formatEur } from "@/lib/format";
import { setMandateDepositPaid, setMandateFinalPaid } from "@/lib/crm-actions";
import { mandateRevenue, type RecruitingMandate } from "@/lib/crm-types";

/**
 * Festpreis-Zahlungs-Gate: Anzahlung bezahlt → Suche starten;
 * Restzahlung bei Besetzung der Stelle.
 */
export function MandatePaymentGate({ mandate }: { mandate: RecruitingMandate }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [depositPaid, setDepositPaid] = useState(Boolean(mandate.deposit_paid));
  const [finalPaid, setFinalPaid] = useState(Boolean(mandate.final_paid));
  const [msg, setMsg] = useState<string | null>(null);

  const positions = mandate.positions || 1;
  const total = mandateRevenue(mandate);
  const depositTotal = (mandate.deposit ?? 0) * positions;
  const restTotal = Math.max(0, total - depositTotal);

  function toggleDeposit() {
    const next = !depositPaid;
    setDepositPaid(next);
    setMsg(null);
    start(async () => {
      const res = await setMandateDepositPaid(mandate.id, next);
      if (!res.ok) {
        setDepositPaid(!next);
        setMsg(res.error ?? "Fehlgeschlagen.");
        return;
      }
      if (res.warning) setMsg(res.warning);
      else if (next) setMsg("Anzahlung erfasst – Sourcing-Aufgabe „Suche starten“ wurde angelegt.");
      if (!res.demo) router.refresh();
    });
  }

  function toggleFinal() {
    const next = !finalPaid;
    setFinalPaid(next);
    setMsg(null);
    start(async () => {
      const res = await setMandateFinalPaid(mandate.id, next);
      if (!res.ok) {
        setFinalPaid(!next);
        setMsg(res.error ?? "Fehlgeschlagen.");
        return;
      }
      if (res.warning) setMsg(res.warning);
      if (!res.demo) router.refresh();
    });
  }

  return (
    <Card className={cn(depositPaid ? "border-success/30" : "border-brand/25")}>
      <CardBody className="space-y-3">
        <SectionHeader
          title="Zahlungs-Status (Festpreis)"
          hint="Anzahlung → Suche starten · Restzahlung bei Besetzung"
          action={
            depositPaid ? (
              <Badge tone="success">
                <IconSearch size={11} /> Suche läuft
              </Badge>
            ) : (
              <Badge tone="warning">Wartet auf Anzahlung</Badge>
            )
          }
        />

        {/* Anzahlung */}
        <button
          type="button"
          onClick={toggleDeposit}
          disabled={pending}
          className={cn(
            "flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition-colors disabled:opacity-60",
            depositPaid ? "border-success/40 bg-success/[0.06]" : "border-border bg-surface hover:border-brand/40"
          )}
        >
          <span
            className={cn(
              "flex h-6 w-6 flex-none items-center justify-center rounded-md border",
              depositPaid ? "border-success bg-success text-white" : "border-border text-transparent"
            )}
          >
            <IconCheck size={14} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-semibold text-ink">Anzahlung {formatEur(depositTotal)} bezahlt?</span>
            <span className="block text-xs text-muted">{depositPaid ? "Erhalten – Suche/Sourcing kann starten." : "Bei Beauftragung fällig. Nach Eingang startet die Suche."}</span>
          </span>
          <IconEuro size={16} className={depositPaid ? "text-success" : "text-faint"} />
        </button>

        {/* Restzahlung */}
        <button
          type="button"
          onClick={toggleFinal}
          disabled={pending}
          className={cn(
            "flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition-colors disabled:opacity-60",
            finalPaid ? "border-success/40 bg-success/[0.06]" : "border-border bg-surface hover:border-brand/40"
          )}
        >
          <span
            className={cn(
              "flex h-6 w-6 flex-none items-center justify-center rounded-md border",
              finalPaid ? "border-success bg-success text-white" : "border-border text-transparent"
            )}
          >
            <IconCheck size={14} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-semibold text-ink">Restzahlung {formatEur(restTotal)} bezahlt?</span>
            <span className="block text-xs text-muted">{finalPaid ? "Erhalten – Honorar vollständig beglichen." : "Fällig bei Besetzung der Stelle (Vertragsunterzeichnung)."}</span>
          </span>
          <IconEuro size={16} className={finalPaid ? "text-success" : "text-faint"} />
        </button>

        {msg ? <p className="text-xs text-muted">{msg}</p> : null}
      </CardBody>
    </Card>
  );
}
