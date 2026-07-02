"use client";

import { useState, useTransition } from "react";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { IconTarget, IconCheck, IconAlertTriangle } from "@/components/ui/icons";
import { cn } from "@/components/ui/cn";
import { toast } from "@/lib/toast";
import { rankProjectsForCandidateAction, proposeMatch } from "@/lib/matches-actions";
import type { ProjectMatchHit } from "@/lib/candidate-project-match";

/** Reverse-Match: passende offene HubSpot-Projekte für diese:n Kandidat:in. */
export function CandidateProjectMatch({ candidateId }: { candidateId: string }) {
  const [hits, setHits] = useState<ProjectMatchHit[] | null>(null);
  const [vorstellbar, setVorstellbar] = useState(false);
  const [pending, start] = useTransition();
  const [proposing, setProposing] = useState<string | null>(null);

  function run() {
    start(async () => {
      const res = await rankProjectsForCandidateAction(candidateId);
      if (!res.ok) {
        toast.error(res.error ?? "Match fehlgeschlagen.");
        return;
      }
      setHits(res.hits);
      setVorstellbar(res.vorstellbar);
    });
  }

  function propose(hit: ProjectMatchHit) {
    setProposing(hit.projectRefId);
    start(async () => {
      const res = await proposeMatch(candidateId, hit.projectRefId, {
        score: hit.score,
        gruende: hit.reasons,
      });
      setProposing(null);
      if (res.ok) toast.success("Für dieses Projekt vorgeschlagen.");
      else toast.error(res.error ?? "Vorschlagen nicht möglich.");
    });
  }

  if (hits === null) {
    return (
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-sm text-muted">Offene HubSpot-Projekte gegen dieses Profil ranken.</span>
        <button
          type="button"
          onClick={run}
          disabled={pending}
          className="inline-flex items-center gap-1.5 rounded-lg border border-brand/40 bg-brand/10 px-2.5 py-1.5 text-xs font-semibold text-brand-deep transition-colors hover:bg-brand/15 disabled:opacity-60"
        >
          <IconTarget size={13} /> {pending ? "Matche …" : "Projekte matchen"}
        </button>
      </div>
    );
  }

  if (hits.length === 0) {
    return <EmptyState title="Kein passendes offenes Projekt gefunden (oder noch kein HubSpot-Sync)." />;
  }

  return (
    <div className="space-y-3">
      {!vorstellbar ? (
        <p className="flex items-center gap-1.5 rounded-lg border border-warning/30 bg-warning/[0.06] px-2.5 py-1.5 text-xs text-warning">
          <IconAlertTriangle size={13} className="flex-none" /> Ohne gültige Einwilligung nicht vorstellbar – erst einholen.
        </p>
      ) : null}
      <ul className="divide-y divide-border">
        {hits.map((h) => (
          <li key={h.projectRefId} className="flex items-center gap-3 py-2.5">
            <span
              className={cn(
                "flex h-9 w-9 flex-none items-center justify-center rounded-lg text-xs font-black",
                h.score >= 60 ? "bg-success/15 text-success" : h.score >= 30 ? "bg-warning/15 text-warning" : "bg-elevated text-faint"
              )}
            >
              {h.score}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-ink">{h.titel}</p>
              <p className="truncate text-xs text-faint">
                {[h.kunde, h.reasons.join(" · ")].filter(Boolean).join(" · ") || "—"}
              </p>
            </div>
            <button
              type="button"
              onClick={() => propose(h)}
              disabled={pending || !vorstellbar}
              title={vorstellbar ? "Diesem Projekt vorschlagen" : "Erst Einwilligung einholen"}
              className="inline-flex flex-none items-center gap-1 rounded-lg border border-border bg-surface px-2.5 py-1.5 text-xs font-semibold text-ink hover:bg-elevated disabled:opacity-50"
            >
              {proposing === h.projectRefId ? "…" : (<><IconCheck size={12} /> Vorschlagen</>)}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
