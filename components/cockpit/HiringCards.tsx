"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/Badge";
import { IconPlus, IconTrash, IconCheck } from "@/components/ui/icons";
import { formatDate, formatEur } from "@/lib/format";
import {
  createInterview,
  updateInterview,
  deleteInterview,
  createOffer,
  updateOffer,
  deleteOffer,
} from "@/lib/hiring-actions";
import type {
  Interview,
  InterviewStatus,
  InterviewType,
  Offer,
  OfferStatus,
} from "@/lib/crm-types";

const input =
  "w-full rounded-lg border border-border bg-surface px-2.5 py-1.5 text-sm text-ink placeholder:text-faint focus-visible:ring-2 focus-visible:ring-brand";

// ---------- Interviews ----------------------------------------------

const ivType: Record<InterviewType, string> = {
  telefon: "Telefon",
  video: "Video",
  vor_ort: "Vor Ort",
  kundengespraech: "Kundengespräch",
};
const ivStatus: Record<InterviewStatus, { label: string; tone: "neutral" | "sky" | "success" | "danger" | "warning" }> = {
  geplant: { label: "Geplant", tone: "sky" },
  stattgefunden: { label: "Stattgefunden", tone: "success" },
  abgesagt: { label: "Abgesagt", tone: "danger" },
  verschoben: { label: "Verschoben", tone: "warning" },
};

function fmtDateTime(iso?: string): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return formatDate(iso);
  return d.toLocaleString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

export function InterviewsCard({
  candidateId,
  mandateId,
  interviews,
}: {
  candidateId: string;
  mandateId?: string;
  interviews: Interview[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [when, setWhen] = useState("");
  const [type, setType] = useState<InterviewType>("telefon");
  const [interviewer, setInterviewer] = useState("");
  const [status, setStatus] = useState<InterviewStatus>("geplant");
  const [score, setScore] = useState<number>(0);
  const [feedback, setFeedback] = useState("");

  function submit() {
    setError(null);
    start(async () => {
      const res = await createInterview({
        candidate_id: candidateId,
        mandate_id: mandateId || null,
        scheduled_at: when ? new Date(when).toISOString() : null,
        type,
        interviewer: interviewer || null,
        status,
        score: score || null,
        feedback: feedback || null,
      });
      if (!res.ok) return setError(res.error ?? "Speichern fehlgeschlagen.");
      setOpen(false);
      setWhen(""); setInterviewer(""); setFeedback(""); setScore(0); setStatus("geplant");
      if (!res.demo) router.refresh();
    });
  }

  function setStat(id: string, s: InterviewStatus) {
    start(async () => {
      const res = await updateInterview(id, candidateId, { status: s });
      if (res.ok && !res.demo) router.refresh();
    });
  }
  function remove(id: string) {
    start(async () => {
      const res = await deleteInterview(id, candidateId);
      if (res.ok && !res.demo) router.refresh();
    });
  }

  return (
    <div className="space-y-3">
      {interviews.length === 0 ? (
        <p className="text-sm text-muted">Noch keine Interviews terminiert.</p>
      ) : (
        <ul className="space-y-2">
          {interviews.map((iv) => {
            const sm = ivStatus[iv.status];
            return (
              <li key={iv.id} className="rounded-xl border border-border bg-elevated/40 p-2.5">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-ink">
                      {ivType[iv.type]} · {fmtDateTime(iv.scheduled_at)}
                    </p>
                    <p className="truncate text-xs text-faint">
                      {iv.interviewer ? `mit ${iv.interviewer}` : "Interviewer offen"}
                      {iv.score ? ` · ${"★".repeat(iv.score)}${"☆".repeat(5 - iv.score)}` : ""}
                    </p>
                  </div>
                  <Badge tone={sm.tone}>{sm.label}</Badge>
                </div>
                {iv.feedback ? (
                  <p className="mt-1.5 whitespace-pre-line rounded-lg bg-surface px-2.5 py-1.5 text-xs text-ink">{iv.feedback}</p>
                ) : null}
                <div className="mt-1.5 flex items-center justify-between gap-2">
                  <select
                    value={iv.status}
                    onChange={(e) => setStat(iv.id, e.target.value as InterviewStatus)}
                    disabled={pending}
                    className="rounded-lg border border-border bg-surface px-2 py-1 text-xs text-ink"
                  >
                    {(Object.keys(ivStatus) as InterviewStatus[]).map((s) => (
                      <option key={s} value={s}>{ivStatus[s].label}</option>
                    ))}
                  </select>
                  <button type="button" aria-label="löschen" onClick={() => remove(iv.id)} disabled={pending}
                    className="rounded-lg p-1.5 text-faint hover:bg-danger/10 hover:text-danger">
                    <IconTrash size={13} />
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {error ? <p className="text-xs text-danger">{error}</p> : null}

      {open ? (
        <div className="space-y-2 rounded-xl border border-border bg-surface p-3">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="mb-1 block text-[0.7rem] font-medium text-muted">Termin</label>
              <input type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} className={input} />
            </div>
            <div>
              <label className="mb-1 block text-[0.7rem] font-medium text-muted">Art</label>
              <select value={type} onChange={(e) => setType(e.target.value as InterviewType)} className={input}>
                {(Object.keys(ivType) as InterviewType[]).map((t) => (
                  <option key={t} value={t}>{ivType[t]}</option>
                ))}
              </select>
            </div>
          </div>
          <input placeholder="Interviewer" value={interviewer} onChange={(e) => setInterviewer(e.target.value)} className={input} />
          <div className="grid grid-cols-2 gap-2">
            <select value={status} onChange={(e) => setStatus(e.target.value as InterviewStatus)} className={input}>
              {(Object.keys(ivStatus) as InterviewStatus[]).map((s) => (
                <option key={s} value={s}>{ivStatus[s].label}</option>
              ))}
            </select>
            <select value={score} onChange={(e) => setScore(Number(e.target.value))} className={input}>
              <option value={0}>Bewertung —</option>
              {[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{"★".repeat(n)} ({n})</option>)}
            </select>
          </div>
          <textarea placeholder="Feedback / Scorecard-Notizen" rows={2} value={feedback} onChange={(e) => setFeedback(e.target.value)} className={input} />
          <div className="flex items-center justify-end gap-2">
            <button type="button" onClick={() => setOpen(false)} className="rounded-lg px-2.5 py-1 text-xs text-muted hover:text-ink">Abbrechen</button>
            <button type="button" onClick={submit} disabled={pending}
              className="inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-brand to-sky px-3 py-1.5 text-xs font-semibold text-white shadow-glow disabled:opacity-60">
              <IconCheck size={12} /> {pending ? "…" : "Speichern"}
            </button>
          </div>
        </div>
      ) : (
        <button type="button" onClick={() => setOpen(true)}
          className="inline-flex items-center gap-1.5 rounded-lg border border-brand/30 bg-brand/10 px-2.5 py-1.5 text-xs font-semibold text-brand-deep hover:bg-brand/15">
          <IconPlus size={13} /> Interview terminieren
        </button>
      )}
    </div>
  );
}

// ---------- Angebote -------------------------------------------------

const offerStatus: Record<OfferStatus, { label: string; tone: "neutral" | "sky" | "brand" | "success" | "danger" | "warning" }> = {
  entwurf: { label: "Entwurf", tone: "neutral" },
  versendet: { label: "Versendet", tone: "sky" },
  in_verhandlung: { label: "In Verhandlung", tone: "warning" },
  angenommen: { label: "Angenommen", tone: "success" },
  abgelehnt: { label: "Abgelehnt", tone: "danger" },
};

export function OffersCard({
  candidateId,
  mandateId,
  defaultSalary,
  offers,
}: {
  candidateId: string;
  mandateId?: string;
  defaultSalary?: number;
  offers: Offer[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [declineFor, setDeclineFor] = useState<string | null>(null);
  const [declineReason, setDeclineReason] = useState("");

  const [salary, setSalary] = useState<number>(defaultSalary ?? 0);
  const [startDate, setStartDate] = useState("");
  const [offerDate, setOfferDate] = useState("");
  const [status, setStatus] = useState<OfferStatus>("versendet");
  const [notes, setNotes] = useState("");

  function submit() {
    setError(null);
    start(async () => {
      const res = await createOffer({
        candidate_id: candidateId,
        mandate_id: mandateId || null,
        offered_salary: salary || null,
        start_date: startDate || null,
        offer_date: offerDate || null,
        status,
        notes: notes || null,
      });
      if (!res.ok) return setError(res.error ?? "Speichern fehlgeschlagen.");
      setOpen(false); setStartDate(""); setOfferDate(""); setNotes("");
      if (!res.demo) router.refresh();
    });
  }

  function setStat(o: Offer, s: OfferStatus) {
    if (s === "abgelehnt") {
      setDeclineFor(o.id);
      setDeclineReason(o.decline_reason ?? "");
      return;
    }
    start(async () => {
      const res = await updateOffer(o.id, candidateId, { status: s });
      if (res.ok && !res.demo) router.refresh();
    });
  }
  function confirmDecline(id: string) {
    start(async () => {
      const res = await updateOffer(id, candidateId, { status: "abgelehnt", decline_reason: declineReason || null });
      if (res.ok) { setDeclineFor(null); if (!res.demo) router.refresh(); }
    });
  }
  function remove(id: string) {
    start(async () => {
      const res = await deleteOffer(id, candidateId);
      if (res.ok && !res.demo) router.refresh();
    });
  }

  return (
    <div className="space-y-3">
      {offers.length === 0 ? (
        <p className="text-sm text-muted">Noch kein Angebot erfasst.</p>
      ) : (
        <ul className="space-y-2">
          {offers.map((o) => {
            const sm = offerStatus[o.status];
            return (
              <li key={o.id} className="rounded-xl border border-border bg-elevated/40 p-2.5">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-ink">
                      {o.offered_salary ? `${formatEur(o.offered_salary)}/J` : "Gehalt offen"}
                      {o.start_date ? ` · Start ${formatDate(o.start_date)}` : ""}
                    </p>
                    <p className="truncate text-xs text-faint">
                      {o.offer_date ? `Angebot ${formatDate(o.offer_date)}` : "Angebotsdatum offen"}
                    </p>
                  </div>
                  <Badge tone={sm.tone}>{sm.label}</Badge>
                </div>
                {o.decline_reason ? (
                  <p className="mt-1.5 rounded-lg bg-danger/10 px-2.5 py-1.5 text-xs text-danger">
                    Ablehnungsgrund: {o.decline_reason}
                  </p>
                ) : null}
                {declineFor === o.id ? (
                  <div className="mt-1.5 space-y-1.5">
                    <textarea rows={2} placeholder="Ablehnungsgrund (wertvoll fürs KI-Matching)" value={declineReason}
                      onChange={(e) => setDeclineReason(e.target.value)} className={input} />
                    <div className="flex justify-end gap-2">
                      <button type="button" onClick={() => setDeclineFor(null)} className="rounded-lg px-2 py-1 text-xs text-muted">Abbrechen</button>
                      <button type="button" onClick={() => confirmDecline(o.id)} disabled={pending}
                        className="rounded-lg bg-danger/10 px-2.5 py-1 text-xs font-semibold text-danger">Als abgelehnt speichern</button>
                    </div>
                  </div>
                ) : (
                  <div className="mt-1.5 flex items-center justify-between gap-2">
                    <select value={o.status} onChange={(e) => setStat(o, e.target.value as OfferStatus)} disabled={pending}
                      className="rounded-lg border border-border bg-surface px-2 py-1 text-xs text-ink">
                      {(Object.keys(offerStatus) as OfferStatus[]).map((s) => (
                        <option key={s} value={s}>{offerStatus[s].label}</option>
                      ))}
                    </select>
                    <button type="button" aria-label="löschen" onClick={() => remove(o.id)} disabled={pending}
                      className="rounded-lg p-1.5 text-faint hover:bg-danger/10 hover:text-danger">
                      <IconTrash size={13} />
                    </button>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {error ? <p className="text-xs text-danger">{error}</p> : null}

      {open ? (
        <div className="space-y-2 rounded-xl border border-border bg-surface p-3">
          <div>
            <label className="mb-1 block text-[0.7rem] font-medium text-muted">Angebotenes Gehalt (€/Jahr)</label>
            <input type="number" min={0} value={salary} onChange={(e) => setSalary(Number(e.target.value) || 0)} className={input} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="mb-1 block text-[0.7rem] font-medium text-muted">Eintritt</label>
              <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className={input} />
            </div>
            <div>
              <label className="mb-1 block text-[0.7rem] font-medium text-muted">Angebotsdatum</label>
              <input type="date" value={offerDate} onChange={(e) => setOfferDate(e.target.value)} className={input} />
            </div>
          </div>
          <select value={status} onChange={(e) => setStatus(e.target.value as OfferStatus)} className={input}>
            {(Object.keys(offerStatus) as OfferStatus[]).map((s) => (
              <option key={s} value={s}>{offerStatus[s].label}</option>
            ))}
          </select>
          <textarea placeholder="Notizen" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} className={input} />
          <div className="flex items-center justify-end gap-2">
            <button type="button" onClick={() => setOpen(false)} className="rounded-lg px-2.5 py-1 text-xs text-muted hover:text-ink">Abbrechen</button>
            <button type="button" onClick={submit} disabled={pending}
              className="inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-brand to-sky px-3 py-1.5 text-xs font-semibold text-white shadow-glow disabled:opacity-60">
              <IconCheck size={12} /> {pending ? "…" : "Angebot speichern"}
            </button>
          </div>
        </div>
      ) : (
        <button type="button" onClick={() => setOpen(true)}
          className="inline-flex items-center gap-1.5 rounded-lg border border-brand/30 bg-brand/10 px-2.5 py-1.5 text-xs font-semibold text-brand-deep hover:bg-brand/15">
          <IconPlus size={13} /> Angebot erfassen
        </button>
      )}
    </div>
  );
}
