"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Dialog } from "@/components/ui/Dialog";
import { Button } from "@/components/ui/Button";
import { IconPlus } from "@/components/ui/icons";
import { addTask } from "@/lib/crm-actions";
import type { RelatedType } from "@/lib/task-link";

export interface EntityOpt {
  label: string;
  id: string;
}

const inputClass =
  "w-full rounded-xl border border-border bg-surface px-3 py-2 text-sm text-ink placeholder:text-faint focus-visible:ring-2 focus-visible:ring-brand";

export function TaskCreateDialog({
  customers,
  candidates,
  projects,
  defaultDate,
  autoOpenParam,
}: {
  customers: EntityOpt[];
  candidates: EntityOpt[];
  projects: EntityOpt[];
  defaultDate?: string;
  /** Öffnet den Dialog automatisch bei ?<param>=1 (Mobile-FAB-Deeplink). */
  autoOpenParam?: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!autoOpenParam) return;
    const sp = new URLSearchParams(window.location.search);
    if (sp.get(autoOpenParam) !== "1") return;
    setOpen(true);
    sp.delete(autoOpenParam);
    const qs = sp.toString();
    window.history.replaceState(null, "", window.location.pathname + (qs ? `?${qs}` : ""));
  }, [autoOpenParam]);
  const [type, setType] = useState<RelatedType>("none");
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const titleRef = useRef<HTMLInputElement>(null);
  const relRef = useRef<HTMLInputElement>(null);
  const dateRef = useRef<HTMLInputElement>(null);
  const timeRef = useRef<HTMLInputElement>(null);
  const notesRef = useRef<HTMLTextAreaElement>(null);

  const opts =
    type === "customer" ? customers : type === "candidate" ? candidates : type === "project" ? projects : [];

  function save() {
    setError(null);
    const title = titleRef.current?.value.trim();
    if (!title) {
      setError("Titel ist erforderlich.");
      return;
    }
    const relLabel = type === "none" ? null : relRef.current?.value.trim() || null;
    const relId = relLabel ? opts.find((o) => o.label === relLabel)?.id ?? null : null;
    start(async () => {
      const res = await addTask({
        related_type: type,
        related_id: relId,
        related_label: relLabel,
        title,
        due_date: dateRef.current?.value || null,
        due_time: timeRef.current?.value || null,
        notes: notesRef.current?.value || null,
      });
      if (res.ok) {
        setOpen(false);
        setType("none");
        if (!res.demo) router.refresh();
      } else {
        setError(res.error ?? "Fehler");
      }
    });
  }

  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <IconPlus size={16} /> Termin / Aufgabe
      </Button>

      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title="Neuer Termin / Aufgabe"
        description="Optional an Kunde, Projekt oder Kandidat:in binden."
      >
        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-muted">Titel *</label>
            <input ref={titleRef} placeholder="z.B. Angebot nachfassen" className={inputClass} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-muted">Verknüpfung</label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value as RelatedType)}
                className={inputClass}
              >
                <option value="none">Allgemein</option>
                <option value="customer">Kunde</option>
                <option value="project">Projekt</option>
                <option value="candidate">Kandidat:in</option>
              </select>
            </div>
            {type !== "none" ? (
              <div>
                <label className="mb-1 block text-xs font-medium text-muted">Datensatz</label>
                <input
                  ref={relRef}
                  list="task-rel-list"
                  autoComplete="off"
                  placeholder="suchen / wählen"
                  className={inputClass}
                />
                <datalist id="task-rel-list">
                  {opts.map((o) => (
                    <option key={o.id} value={o.label} />
                  ))}
                </datalist>
              </div>
            ) : null}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-muted">Datum</label>
              <input ref={dateRef} type="date" defaultValue={defaultDate} className={inputClass} />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-muted">Uhrzeit</label>
              <input ref={timeRef} type="time" className={inputClass} />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-muted">Notiz</label>
            <textarea ref={notesRef} rows={2} className={inputClass} />
          </div>

          {error ? (
            <p className="rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-xs text-danger">
              {error}
            </p>
          ) : null}

          <div className="flex items-center justify-end gap-2 pt-1">
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              Abbrechen
            </Button>
            <Button type="button" onClick={save} disabled={pending}>
              {pending ? "Speichern …" : "Anlegen"}
            </Button>
          </div>
        </div>
      </Dialog>
    </>
  );
}
