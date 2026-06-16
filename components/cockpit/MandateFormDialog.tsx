"use client";

import { useEffect, useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { useRouter } from "next/navigation";
import { Dialog } from "@/components/ui/Dialog";
import { Button } from "@/components/ui/Button";
import { IconPlus } from "@/components/ui/icons";
import { createMandate, updateMandate, type ActionResult } from "@/lib/crm-actions";
import { formatEur } from "@/lib/format";
import type { RecruitingMandate } from "@/lib/crm-types";

const inputClass =
  "w-full rounded-xl border border-border bg-surface px-3 py-2 text-sm text-ink placeholder:text-faint focus-visible:ring-2 focus-visible:ring-brand";

type Pricing = "fixed" | "percent";

export function MandateFormDialog({
  accountNames = [],
  mandate,
  renderTrigger,
}: {
  accountNames?: string[];
  mandate?: RecruitingMandate;
  renderTrigger?: (open: () => void) => React.ReactNode;
}) {
  const isEdit = Boolean(mandate);
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [state, formAction] = useFormState(
    isEdit ? updateMandate : createMandate,
    null as ActionResult | null
  );

  const [pricing, setPricing] = useState<Pricing>(mandate?.pricing_model ?? "fixed");
  const [positions, setPositions] = useState<number>(mandate?.positions ?? 1);
  const [fee, setFee] = useState<number>(mandate?.fee ?? 9999);
  const [targetSalary, setTargetSalary] = useState<number>(mandate?.target_salary ?? 60000);
  const [feePercent, setFeePercent] = useState<number>(mandate?.fee_percent ?? 25);

  useEffect(() => {
    if (state?.ok && !state.demo) {
      setOpen(false);
      router.refresh();
    }
  }, [state, router]);

  const perPosition = pricing === "percent" ? targetSalary * (feePercent / 100) : fee;
  const expected = Math.round(perPosition * (positions || 1));

  return (
    <>
      {renderTrigger ? (
        renderTrigger(() => setOpen(true))
      ) : (
        <Button onClick={() => setOpen(true)}>
          <IconPlus size={16} /> Mandat anlegen
        </Button>
      )}

      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title={isEdit ? "Mandat bearbeiten" : "Neues Recruiting-Mandat"}
        description="Offene Stelle mit Preismodell, Stellenanzahl und Deadline."
      >
        <form action={formAction} className="space-y-4">
          {isEdit ? <input type="hidden" name="id" value={mandate!.id} /> : null}

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="mb-1 block text-xs font-medium text-muted">Account *</label>
              <input
                name="account_name"
                list="mandate-accounts"
                defaultValue={mandate?.account_name}
                required
                autoComplete="off"
                placeholder="Muster GmbH"
                className={inputClass}
              />
              <datalist id="mandate-accounts">
                {accountNames.map((a) => (
                  <option key={a} value={a} />
                ))}
              </datalist>
            </div>
            <div className="sm:col-span-2">
              <label className="mb-1 block text-xs font-medium text-muted">Position</label>
              <input name="role" defaultValue={mandate?.role} placeholder="z.B. Pflegefachkraft (m/w/d)" className={inputClass} />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-muted">Anzahl Stellen</label>
              <input
                name="positions"
                type="number"
                min={1}
                value={positions}
                onChange={(e) => setPositions(Number(e.target.value) || 0)}
                className={inputClass}
              />
            </div>
            {isEdit ? (
              <div>
                <label className="mb-1 block text-xs font-medium text-muted">Davon besetzt</label>
                <input name="filled" type="number" min={0} defaultValue={mandate?.filled ?? 0} className={inputClass} />
              </div>
            ) : null}
          </div>

          {/* Preismodell */}
          <div className="rounded-xl border border-border bg-elevated/40 p-3">
            <label className="mb-2 block text-xs font-medium text-muted">Preismodell</label>
            <input type="hidden" name="pricing_model" value={pricing} />
            <div className="mb-3 grid grid-cols-2 gap-2">
              {(["fixed", "percent"] as const).map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setPricing(p)}
                  className={
                    "rounded-lg border px-3 py-2 text-sm font-medium transition-colors " +
                    (pricing === p
                      ? "border-brand bg-brand/10 text-brand-deep"
                      : "border-border bg-surface text-muted hover:border-brand/40")
                  }
                >
                  {p === "fixed" ? "Festpreis je Stelle" : "% vom Zielgehalt"}
                </button>
              ))}
            </div>

            {pricing === "fixed" ? (
              <div>
                <label className="mb-1 block text-xs font-medium text-muted">Festpreis je Stelle (€)</label>
                <input
                  name="fee"
                  type="number"
                  min={0}
                  value={fee}
                  onChange={(e) => setFee(Number(e.target.value) || 0)}
                  className={inputClass}
                />
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-medium text-muted">Bruttojahreszielgehalt (€)</label>
                  <input
                    name="target_salary"
                    type="number"
                    min={0}
                    value={targetSalary}
                    onChange={(e) => setTargetSalary(Number(e.target.value) || 0)}
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-muted">Honorarsatz (%)</label>
                  <div className="flex gap-1.5">
                    {[25, 27].map((p) => (
                      <button
                        key={p}
                        type="button"
                        onClick={() => setFeePercent(p)}
                        className={
                          "rounded-lg border px-2.5 py-1 text-xs font-medium " +
                          (feePercent === p
                            ? "border-brand bg-brand/10 text-brand-deep"
                            : "border-border bg-surface text-muted hover:border-brand/40")
                        }
                      >
                        {p} %
                      </button>
                    ))}
                    <input
                      name="fee_percent"
                      type="number"
                      min={0}
                      max={100}
                      value={feePercent}
                      onChange={(e) => setFeePercent(Number(e.target.value) || 0)}
                      className={inputClass + " flex-1"}
                    />
                  </div>
                </div>
              </div>
            )}

            <div className="mt-3 flex items-center justify-between border-t border-border/60 pt-2 text-sm">
              <span className="text-muted">Erwarteter Umsatz</span>
              <span className="font-bold text-brand-deep">{formatEur(expected)}</span>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-medium text-muted">Status</label>
              <select name="status" defaultValue={mandate?.status ?? "offen"} className={inputClass}>
                <option value="offen">Offen</option>
                <option value="in_arbeit">In Arbeit</option>
                <option value="interviews">Interviews</option>
                <option value="besetzt">Besetzt</option>
                <option value="pausiert">Pausiert</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-muted">Deadline</label>
              <input name="deadline" type="date" defaultValue={mandate?.deadline || ""} className={inputClass} />
            </div>
          </div>

          {state?.error ? (
            <p className="rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-xs text-danger">
              {state.error}
            </p>
          ) : null}
          {state?.ok && state.demo ? (
            <p className="rounded-lg border border-warning/30 bg-warning/10 px-3 py-2 text-xs text-warning">
              Demo-Modus: nicht gespeichert.
            </p>
          ) : null}

          <div className="flex items-center justify-end gap-2 pt-1">
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              Abbrechen
            </Button>
            <SubmitButton label={isEdit ? "Speichern" : "Anlegen"} />
          </div>
        </form>
      </Dialog>
    </>
  );
}

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Speichern …" : label}
    </Button>
  );
}
