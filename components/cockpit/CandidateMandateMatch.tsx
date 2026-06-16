"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { IconSpark, IconCheck } from "@/components/ui/icons";
import { cn } from "@/components/ui/cn";
import {
  matchMandatesForCandidate,
  submitCandidateToMandate,
  type MandateMatch,
} from "@/lib/match";

function scoreTone(s: number): string {
  return s >= 70 ? "bg-success" : s >= 45 ? "bg-warning" : "bg-danger";
}

/** Reverse-Match: passende offene Mandate für diese:n Kandidat:in. */
export function CandidateMandateMatch({ candidateId }: { candidateId: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [matches, setMatches] = useState<MandateMatch[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState<string | null>(null);
  const [done, setDone] = useState<Set<string>>(new Set());

  function run() {
    setError(null);
    start(async () => {
      const res = await matchMandatesForCandidate(candidateId);
      if (!res.ok) {
        setError(res.error ?? "Suche fehlgeschlagen.");
        return;
      }
      setMatches(res.matches ?? []);
    });
  }

  async function present(mandateId: string) {
    setSubmitting(mandateId);
    setError(null);
    const res = await submitCandidateToMandate(candidateId, mandateId);
    setSubmitting(null);
    if (res.ok) {
      setDone((p) => new Set(p).add(mandateId));
      if (!res.demo) router.refresh();
    } else {
      setError(res.error ?? "Vorstellen fehlgeschlagen.");
    }
  }

  return (
    <div className="space-y-3">
      <button
        type="button"
        onClick={run}
        disabled={pending}
        className="inline-flex items-center gap-1.5 rounded-lg border border-brand/30 bg-brand/10 px-2.5 py-1.5 text-xs font-semibold text-brand-deep transition-colors hover:bg-brand/15 disabled:opacity-60"
      >
        <IconSpark size={13} /> {pending ? "sucht …" : "Passende Mandate finden"}
      </button>

      {error ? <p className="text-xs text-danger">{error}</p> : null}

      {matches ? (
        matches.length === 0 ? (
          <p className="text-sm text-muted">Keine offenen Mandate.</p>
        ) : (
          <ul className="space-y-2">
            {matches.map((m) => {
              const presented = m.already || done.has(m.mandate_id);
              return (
                <li key={m.mandate_id} className="rounded-xl border border-border bg-elevated/40 p-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <Link
                      href={`/cockpit/projekte/recruiting/${m.mandate_id}`}
                      className="min-w-0 flex-1"
                    >
                      <p className="truncate text-sm font-semibold text-ink hover:text-brand-deep">
                        {m.role || "Mandat"}
                      </p>
                      <p className="truncate text-xs text-muted">{m.account_name}</p>
                    </Link>
                    <span className="flex-none text-lg font-black tabular-nums text-ink">{m.score}</span>
                  </div>
                  <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-elevated">
                    <div className={cn("h-full rounded-full", scoreTone(m.score))} style={{ width: `${m.score}%` }} />
                  </div>
                  <div className="mt-1.5 flex items-center justify-between gap-2">
                    <div className="flex flex-wrap gap-1">
                      {m.factors.slice(0, 3).map((f) => (
                        <span key={f} className="rounded-full bg-success/10 px-2 py-0.5 text-[0.65rem] font-medium text-success">
                          {f}
                        </span>
                      ))}
                    </div>
                    {presented ? (
                      <span className="inline-flex flex-none items-center gap-1 text-[0.7rem] text-muted">
                        <IconCheck size={12} className="text-success" /> vorgestellt
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => present(m.mandate_id)}
                        disabled={submitting === m.mandate_id}
                        className="flex-none rounded-lg border border-brand/30 bg-brand/10 px-2 py-1 text-[0.7rem] font-semibold text-brand-deep hover:bg-brand/15 disabled:opacity-60"
                      >
                        {submitting === m.mandate_id ? "…" : "Vorstellen"}
                      </button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )
      ) : null}
    </div>
  );
}
