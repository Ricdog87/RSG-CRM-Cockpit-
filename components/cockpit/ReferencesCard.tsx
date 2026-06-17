"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/Badge";
import { IconPlus, IconTrash, IconCheck } from "@/components/ui/icons";
import {
  createReference,
  updateReference,
  deleteReference,
} from "@/lib/references-actions";
import type { CandidateReference, ReferenceStatus } from "@/lib/crm-types";

const input =
  "w-full rounded-lg border border-border bg-surface px-2.5 py-1.5 text-sm text-ink placeholder:text-faint focus-visible:ring-2 focus-visible:ring-brand";

const statusMeta: Record<ReferenceStatus, { label: string; tone: "neutral" | "sky" | "success" | "danger" }> = {
  angefragt: { label: "Angefragt", tone: "sky" },
  ausstehend: { label: "Ausstehend", tone: "neutral" },
  erhalten: { label: "Erhalten", tone: "success" },
  abgelehnt: { label: "Abgelehnt", tone: "danger" },
};

export function ReferencesCard({
  candidateId,
  references,
}: {
  candidateId: string;
  references: CandidateReference[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [relationship, setRelationship] = useState("");
  const [contact, setContact] = useState("");

  function submit() {
    setError(null);
    start(async () => {
      const res = await createReference({
        candidate_id: candidateId,
        referee_name: name || null,
        relationship: relationship || null,
        contact: contact || null,
      });
      if (!res.ok) return setError(res.error ?? "Speichern fehlgeschlagen.");
      setOpen(false); setName(""); setRelationship(""); setContact("");
      if (!res.demo) router.refresh();
    });
  }
  function setStat(id: string, s: ReferenceStatus) {
    start(async () => {
      const res = await updateReference(id, candidateId, { status: s });
      if (res.ok && !res.demo) router.refresh();
    });
  }
  function saveFeedback(id: string, feedback: string) {
    start(async () => {
      const res = await updateReference(id, candidateId, { feedback, status: "erhalten" });
      if (res.ok && !res.demo) router.refresh();
    });
  }
  function remove(id: string) {
    start(async () => {
      const res = await deleteReference(id, candidateId);
      if (res.ok && !res.demo) router.refresh();
    });
  }

  return (
    <div className="space-y-3">
      {references.length === 0 ? (
        <p className="text-sm text-muted">Noch keine Referenzen erfasst.</p>
      ) : (
        <ul className="space-y-2">
          {references.map((r) => {
            const sm = statusMeta[r.status];
            return (
              <li key={r.id} className="relative rounded-xl border border-border bg-elevated/40 p-2.5">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-ink">{r.referee_name || "Referenzgeber:in"}</p>
                    <p className="truncate text-xs text-faint">
                      {[r.relationship, r.contact].filter(Boolean).join(" · ") || "—"}
                    </p>
                  </div>
                  <Badge tone={sm.tone}>{sm.label}</Badge>
                </div>
                {r.feedback ? (
                  <p className="mt-1.5 whitespace-pre-line rounded-lg bg-surface px-2.5 py-1.5 text-xs text-ink">{r.feedback}</p>
                ) : null}
                <div className="mt-1.5 flex items-center justify-between gap-2">
                  <select value={r.status} onChange={(e) => setStat(r.id, e.target.value as ReferenceStatus)} disabled={pending}
                    className="rounded-lg border border-border bg-surface px-2 py-1 text-xs text-ink">
                    {(Object.keys(statusMeta) as ReferenceStatus[]).map((s) => (
                      <option key={s} value={s}>{statusMeta[s].label}</option>
                    ))}
                  </select>
                  <div className="flex items-center gap-1">
                    <FeedbackButton onSave={(f) => saveFeedback(r.id, f)} initial={r.feedback ?? ""} disabled={pending} />
                    <button type="button" aria-label="löschen" onClick={() => remove(r.id)} disabled={pending}
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

      {open ? (
        <div className="space-y-2 rounded-xl border border-border bg-surface p-3">
          <input placeholder="Name Referenzgeber:in" value={name} onChange={(e) => setName(e.target.value)} className={input} />
          <input placeholder="Beziehung (z.B. ehem. Vorgesetzte:r)" value={relationship} onChange={(e) => setRelationship(e.target.value)} className={input} />
          <input placeholder="Kontakt (Telefon/E-Mail)" value={contact} onChange={(e) => setContact(e.target.value)} className={input} />
          <div className="flex items-center justify-end gap-2">
            <button type="button" onClick={() => setOpen(false)} className="rounded-lg px-2.5 py-1 text-xs text-muted hover:text-ink">Abbrechen</button>
            <button type="button" onClick={submit} disabled={pending}
              className="inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-brand to-sky px-3 py-1.5 text-xs font-semibold text-white shadow-glow disabled:opacity-60">
              <IconCheck size={12} /> {pending ? "…" : "Referenz speichern"}
            </button>
          </div>
        </div>
      ) : (
        <button type="button" onClick={() => setOpen(true)}
          className="inline-flex items-center gap-1.5 rounded-lg border border-brand/30 bg-brand/10 px-2.5 py-1.5 text-xs font-semibold text-brand-deep hover:bg-brand/15">
          <IconPlus size={13} /> Referenz hinzufügen
        </button>
      )}
    </div>
  );
}

function FeedbackButton({ onSave, initial, disabled }: { onSave: (f: string) => void; initial: string; disabled: boolean }) {
  const [open, setOpen] = useState(false);
  const [val, setVal] = useState(initial);
  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} disabled={disabled}
        className="rounded-lg border border-border bg-elevated px-2 py-1 text-[0.7rem] font-medium text-ink hover:border-brand/40">
        Feedback
      </button>
    );
  }
  return (
    <div className="absolute right-4 z-10 mt-1 w-56 rounded-xl border border-border bg-surface p-2 shadow-card">
      <textarea rows={3} value={val} onChange={(e) => setVal(e.target.value)} placeholder="Referenz-Feedback …"
        className="w-full rounded-lg border border-border bg-surface px-2 py-1.5 text-xs text-ink" />
      <div className="mt-1.5 flex justify-end gap-1.5">
        <button type="button" onClick={() => setOpen(false)} className="rounded-lg px-2 py-1 text-[0.7rem] text-muted">Abbrechen</button>
        <button type="button" onClick={() => { onSave(val); setOpen(false); }} className="rounded-lg bg-brand/10 px-2 py-1 text-[0.7rem] font-semibold text-brand-deep">Speichern</button>
      </div>
    </div>
  );
}
