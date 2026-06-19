"use client";

import { useEffect, useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { useRouter } from "next/navigation";
import { Dialog } from "@/components/ui/Dialog";
import { Button } from "@/components/ui/Button";
import { IconPlus } from "@/components/ui/icons";
import { createMandate, updateMandate, type ActionResult } from "@/lib/crm-actions";
import { AccountCombobox } from "@/components/cockpit/AccountCombobox";
import { formatEur } from "@/lib/format";
import { toast } from "@/lib/toast";
import { mandatePaymentSchedule, type RecruitingMandate } from "@/lib/crm-types";

const inputClass =
  "w-full rounded-xl border border-border bg-surface px-3 py-2 text-sm text-ink placeholder:text-faint focus-visible:ring-2 focus-visible:ring-brand";

type Pricing = "fixed" | "percent";

export function MandateFormDialog({
  accountNames = [],
  mandate,
  renderTrigger,
  compact = false,
  defaultAccountName,
}: {
  accountNames?: string[];
  mandate?: RecruitingMandate;
  renderTrigger?: (open: () => void) => React.ReactNode;
  /** Kompakter „+ Mandat"-Button – serialisierbar, nutzbar aus Server-Komponenten. */
  compact?: boolean;
  /** Vorbelegung des Kunden beim Anlegen (z.B. aus der Kundenmaske). */
  defaultAccountName?: string;
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
  const [deposit, setDeposit] = useState<number>(mandate?.deposit ?? 2500);
  const [split, setSplit] = useState<boolean>(mandate?.split_payment ?? false);

  useEffect(() => {
    if (state?.ok && !state.demo) {
      toast.success(isEdit ? "Mandat aktualisiert." : "Mandat angelegt.");
      setOpen(false);
      router.refresh();
    }
  }, [state, router, isEdit]);

  // Deeplink vom Mobile-FAB: ?new=1 öffnet den Anlegen-Dialog und säubert die URL.
  useEffect(() => {
    if (isEdit) return;
    const sp = new URLSearchParams(window.location.search);
    if (sp.get("new") !== "1") return;
    setOpen(true);
    sp.delete("new");
    const qs = sp.toString();
    window.history.replaceState(null, "", window.location.pathname + (qs ? `?${qs}` : ""));
  }, [isEdit]);

  const perPosition = pricing === "percent" ? targetSalary * (feePercent / 100) : fee;
  const expected = Math.round(perPosition * (positions || 1));
  // Live-Zahlungsplan aus den aktuellen Eingaben.
  const schedule = mandatePaymentSchedule({
    positions,
    fee,
    pricing_model: pricing,
    target_salary: targetSalary,
    fee_percent: feePercent,
    deposit: pricing === "fixed" ? deposit : 0,
    split_payment: split,
  } as RecruitingMandate);

  return (
    <>
      {renderTrigger ? (
        renderTrigger(() => setOpen(true))
      ) : compact ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="rounded-lg border border-border bg-elevated px-2.5 py-1 text-xs font-semibold text-ink hover:bg-elevated/70"
        >
          + Mandat
        </button>
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
              <AccountCombobox
                name="account_name"
                options={accountNames}
                defaultValue={mandate?.account_name ?? defaultAccountName ?? ""}
                placeholder="Muster GmbH"
                required
              />
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
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
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
                <div>
                  <label className="mb-1 block text-xs font-medium text-muted">Anzahlung je Stelle (€)</label>
                  <input
                    name="deposit"
                    type="number"
                    min={0}
                    value={deposit}
                    onChange={(e) => setDeposit(Number(e.target.value) || 0)}
                    className={inputClass}
                  />
                  <p className="mt-1 text-[0.7rem] text-faint">fix bei Auftrag, Rest bei Vermittlung</p>
                </div>
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

            {/* Erfolgshonorar splitten (50 % Unterzeichnung / 50 % nach 3 Monaten) */}
            <label className="mt-3 flex cursor-pointer items-start gap-2 rounded-lg border border-border bg-surface px-3 py-2">
              <input
                type="checkbox"
                checked={split}
                onChange={(e) => setSplit(e.target.checked)}
                className="mt-0.5 h-4 w-4 flex-none accent-brand"
              />
              <span className="text-xs text-ink">
                Erfolgshonorar splitten
                <span className="block text-[0.7rem] text-faint">
                  50 % bei Vertragsunterzeichnung · 50 % nach 3 Monaten Betriebszugehörigkeit
                </span>
              </span>
            </label>
            <input type="hidden" name="split_payment" value={split ? "1" : "0"} />

            <div className="mt-3 border-t border-border/60 pt-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted">Erwarteter Umsatz</span>
                <span className="font-bold text-brand-deep">{formatEur(expected)}</span>
              </div>
              <ul className="mt-2 space-y-1">
                {schedule.map((p, i) => (
                  <li key={i} className="flex items-center justify-between gap-2 text-xs">
                    <span className="text-faint">{p.label}</span>
                    <span className="flex-none font-medium text-ink">{formatEur(p.amount)}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Original-Stellenausschreibung – Futter fürs intelligente Matching */}
          <div>
            <label className="mb-1 block text-xs font-medium text-muted">
              Original-Stellenausschreibung (vom Kunden)
            </label>
            <textarea
              name="job_posting"
              rows={5}
              defaultValue={mandate?.job_posting ?? ""}
              placeholder="Original-Anzeige hier einfügen – das CRM versteht so genau, was gesucht wird (Aufgaben, Anforderungen, Benefits …)."
              className={inputClass + " resize-y"}
            />
            <p className="mt-1 text-[0.7rem] text-faint">
              Nach dem Speichern: im Mandat über „Anonyme Stellenanzeige erstellen“ einen
              Bewerber-Link generieren (mit „Interessiert / Nicht interessiert“).
            </p>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-medium text-muted">Status</label>
              <select name="status" defaultValue={mandate?.status ?? "offen"} className={inputClass}>
                <option value="angebot">Angebot / Planung</option>
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

          {/* Kundendaten – nur beim Anlegen; wandern in den Account, falls neu. */}
          {!isEdit ? (
            <div className="rounded-xl border border-border bg-elevated/40 p-3">
              <p className="mb-2 text-xs font-medium text-muted">
                Kundendaten <span className="text-faint">(optional – nur falls der Kunde neu ist)</span>
              </p>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <input name="acc_branche" placeholder="Branche" className={inputClass} />
                <input name="acc_ort" placeholder="Ort" className={inputClass} />
                <input name="acc_contact_name" placeholder="Ansprechpartner:in" className={inputClass} />
                <input name="acc_contact_email" type="email" placeholder="Ansprechpartner-E-Mail" className={inputClass} />
              </div>
            </div>
          ) : null}

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
