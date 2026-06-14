"use client";

import { useEffect, useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { useRouter } from "next/navigation";
import { Dialog } from "@/components/ui/Dialog";
import { Button } from "@/components/ui/Button";
import { IconPlus } from "@/components/ui/icons";
import type { ActionResult } from "@/lib/crm-actions";

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
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [state, formAction] = useFormState(action, null);

  useEffect(() => {
    if (state?.ok && !state.demo) {
      setOpen(false);
      router.refresh();
    }
  }, [state, router]);

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
        <form action={formAction} className="space-y-4">
          {hiddenId ? <input type="hidden" name="id" value={hiddenId} /> : null}
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
            <p className="rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-xs text-danger">
              {state.error}
            </p>
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
