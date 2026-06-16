"use client";

import { useState, useTransition } from "react";
import { IconSpark } from "@/components/ui/icons";
import { cn } from "@/components/ui/cn";
import { matchCandidateToMandate, type MatchResult } from "@/lib/candidate-match";

/** KI-Passungsbewertung Kandidat:in ↔ verknüpftes Mandat. */
export function CandidateMatch({ id }: { id: string }) {
  const [pending, start] = useTransition();
  const [res, setRes] = useState<MatchResult | null>(null);

  function run() {
    start(async () => setRes(await matchCandidateToMandate(id)));
  }

  const score = res?.score ?? 0;
  const tone =
    score >= 70 ? "text-success" : score >= 40 ? "text-warning" : "text-danger";

  return (
    <div className="space-y-3">
      {res?.ok ? (
        <div className="space-y-1.5">
          <div className="flex items-baseline gap-2">
            <span className={cn("text-3xl font-black tabular-nums", tone)}>{score}</span>
            <span className="text-sm text-muted">/ 100 Passung</span>
            {res.demo ? (
              <span className="ml-auto text-[0.7rem] text-warning">Demo</span>
            ) : null}
          </div>
          {res.summary ? <p className="text-sm text-muted">{res.summary}</p> : null}
        </div>
      ) : (
        <p className="text-sm text-muted">
          Die KI bewertet die Passung zur verknüpften Mandatsrolle (Rolle &amp; Skills).
        </p>
      )}
      {res && !res.ok ? <p className="text-xs text-danger">{res.error}</p> : null}

      <button
        type="button"
        onClick={run}
        disabled={pending}
        className="inline-flex items-center gap-1.5 rounded-lg border border-brand/30 bg-brand/10 px-2.5 py-1.5 text-xs font-semibold text-brand-deep transition-colors hover:bg-brand/15 disabled:opacity-60"
      >
        <IconSpark size={13} /> {pending ? "bewertet …" : res?.ok ? "Neu bewerten" : "Passung bewerten"}
      </button>
    </div>
  );
}
