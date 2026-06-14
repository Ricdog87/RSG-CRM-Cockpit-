"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { useRouter } from "next/navigation";
import { Dialog } from "@/components/ui/Dialog";
import { Button } from "@/components/ui/Button";
import { IconPlus, IconSpark } from "@/components/ui/icons";
import type { ActionResult } from "@/lib/crm-actions";

export type AutofillFn = (
  input: Record<string, string>
) => Promise<{ ok: boolean; values?: Record<string, string>; error?: string }>;

export interface FormField {
  name: string;
  label: string;
  type?: "text" | "email" | "number" | "date" | "select" | "textarea" | "datalist";
  options?: { value: string; label: string }[];
  required?: boolean;
  placeholder?: string;
  defaultValue?: string;
  full?: boolean;
}

const inputClass =
  "w-full rounded-xl border border-border bg-surface px-3 py-2 text-sm text-ink placeholder:text-faint focus-visible:ring-2 focus-visible:ring-brand";

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} className="w-full sm:w-auto">
      {pending ? "Speichern …" : label}
    </Button>
  );
}

/**
 * Generischer „Anlegen"-Dialog: rendert einen Trigger-Button und ein Formular,
 * das eine Server Action aufruft. Persistiert mit gesetzter Supabase-ENV,
 * sonst Demo-Hinweis.
 */
export function EntityFormDialog({
  triggerLabel,
  title,
  description,
  fields,
  action,
  initial,
  hiddenId,
  submitLabel,
  renderTrigger,
  autofill,
  autofillFrom = ["name"],
  autoOpenParam,
}: {
  triggerLabel?: string;
  title: string;
  description?: string;
  fields: FormField[];
  action: (prev: ActionResult | null, fd: FormData) => Promise<ActionResult>;
  /** Vorbelegung der Felder (Bearbeiten-Modus) */
  initial?: Record<string, string>;
  /** versteckte id für Updates */
  hiddenId?: string;
  submitLabel?: string;
  /** alternativer Trigger (z.B. Icon-Button in einer Tabellenzeile) */
  renderTrigger?: (open: () => void) => React.ReactNode;
  /** KI-Auto-Ausfüllen aus den angegebenen Feldern */
  autofill?: AutofillFn;
  autofillFrom?: string[];
  /** Öffnet den Dialog automatisch, wenn ?<param>=1 in der URL steht (Mobile-FAB-Deeplink). */
  autoOpenParam?: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [state, formAction] = useFormState(action, null);
  const formRef = useRef<HTMLFormElement>(null);
  const forceRef = useRef<HTMLInputElement>(null);
  const [afPending, startAutofill] = useTransition();
  const [afError, setAfError] = useState<string | null>(null);

  useEffect(() => {
    if (state?.ok && !state.demo) {
      setOpen(false);
      router.refresh();
    }
  }, [state, router]);

  // Deeplink vom Mobile-FAB: ?new=1 öffnet den Dialog und säubert die URL.
  useEffect(() => {
    if (!autoOpenParam) return;
    const sp = new URLSearchParams(window.location.search);
    if (sp.get(autoOpenParam) !== "1") return;
    setOpen(true);
    sp.delete(autoOpenParam);
    const qs = sp.toString();
    window.history.replaceState(null, "", window.location.pathname + (qs ? `?${qs}` : ""));
  }, [autoOpenParam]);

  function runAutofill() {
    const form = formRef.current;
    if (!form || !autofill) return;
    setAfError(null);
    const input: Record<string, string> = {};
    for (const key of autofillFrom) {
      const el = form.elements.namedItem(key) as
        | HTMLInputElement
        | HTMLSelectElement
        | null;
      if (el) input[key] = el.value;
    }
    startAutofill(async () => {
      const res = await autofill(input);
      if (!res.ok) {
        setAfError(res.error ?? "Auto-Ausfüllen fehlgeschlagen.");
        return;
      }
      for (const [key, val] of Object.entries(res.values ?? {})) {
        const el = form.elements.namedItem(key) as
          | HTMLInputElement
          | HTMLSelectElement
          | null;
        if (el && !el.value) el.value = val; // bestehende Eingaben nicht überschreiben
        else if (el && el.tagName === "SELECT") el.value = val;
      }
    });
  }

  function confirmAnyway() {
    if (forceRef.current) forceRef.current.value = "1";
    formRef.current?.requestSubmit();
  }

  return (
    <>
      {renderTrigger ? (
        renderTrigger(() => setOpen(true))
      ) : (
        <Button onClick={() => setOpen(true)}>
          <IconPlus size={16} /> {triggerLabel}
        </Button>
      )}

      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title={title}
        description={description}
      >
        <form ref={formRef} action={formAction} className="space-y-4">
          {hiddenId ? <input type="hidden" name="id" value={hiddenId} /> : null}
          <input type="hidden" name="force" ref={forceRef} defaultValue="0" />

          {autofill ? (
            <div className="flex flex-wrap items-center gap-2 rounded-xl border border-brand/25 bg-brand/[0.05] px-3 py-2">
              <button
                type="button"
                onClick={runAutofill}
                disabled={afPending}
                className="inline-flex items-center gap-1.5 rounded-lg bg-brand-deep px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-brand-ink disabled:opacity-60"
              >
                <IconSpark size={13} />
                {afPending ? "Fülle aus …" : "KI: Felder automatisch ausfüllen"}
              </button>
              <span className="text-xs text-muted">
                Name eingeben, Rest schlägt die KI vor.
              </span>
              {afError ? <span className="text-xs text-danger">{afError}</span> : null}
            </div>
          ) : null}

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {fields.map((f) => (
              <div key={f.name} className={f.full ? "sm:col-span-2" : ""}>
                <label
                  htmlFor={f.name}
                  className="mb-1 block text-xs font-medium text-muted"
                >
                  {f.label}
                  {f.required ? <span className="text-danger"> *</span> : null}
                </label>
                {f.type === "select" ? (
                  <select
                    id={f.name}
                    name={f.name}
                    defaultValue={initial?.[f.name] ?? f.defaultValue}
                    required={f.required}
                    className={inputClass}
                  >
                    {(f.options ?? []).map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                ) : f.type === "textarea" ? (
                  <textarea
                    id={f.name}
                    name={f.name}
                    rows={3}
                    placeholder={f.placeholder}
                    defaultValue={initial?.[f.name] ?? f.defaultValue}
                    required={f.required}
                    className={inputClass}
                  />
                ) : f.type === "datalist" ? (
                  <>
                    <input
                      id={f.name}
                      name={f.name}
                      list={`${f.name}-list`}
                      placeholder={f.placeholder}
                      defaultValue={initial?.[f.name] ?? f.defaultValue}
                      required={f.required}
                      autoComplete="off"
                      className={inputClass}
                    />
                    <datalist id={`${f.name}-list`}>
                      {(f.options ?? []).map((o) => (
                        <option key={o.value} value={o.value} />
                      ))}
                    </datalist>
                  </>
                ) : (
                  <input
                    id={f.name}
                    name={f.name}
                    type={f.type ?? "text"}
                    placeholder={f.placeholder}
                    defaultValue={initial?.[f.name] ?? f.defaultValue}
                    required={f.required}
                    className={inputClass}
                  />
                )}
              </div>
            ))}
          </div>

          {state?.error ? (
            <div
              className={`rounded-lg border px-3 py-2 text-xs ${
                state.duplicate
                  ? "border-warning/30 bg-warning/10 text-warning"
                  : "border-danger/30 bg-danger/10 text-danger"
              }`}
            >
              <p>{state.error}</p>
              {state.duplicate ? (
                <button
                  type="button"
                  onClick={confirmAnyway}
                  className="mt-1.5 font-semibold underline hover:no-underline"
                >
                  Trotzdem anlegen
                </button>
              ) : null}
            </div>
          ) : null}
          {state?.ok && state.demo ? (
            <p className="rounded-lg border border-warning/30 bg-warning/10 px-3 py-2 text-xs text-warning">
              Demo-Modus: Eingabe wurde nicht gespeichert. Mit verbundener
              Supabase wird der Datensatz angelegt.
            </p>
          ) : null}

          <div className="flex items-center justify-end gap-2 pt-1">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setOpen(false)}
            >
              Abbrechen
            </Button>
            <SubmitButton label={submitLabel ?? "Anlegen"} />
          </div>
        </form>
      </Dialog>
    </>
  );
}
