"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Card, CardBody, SectionHeader } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { IconChevronRight, IconCheck, IconAlertTriangle } from "@/components/ui/icons";
import { cn } from "@/components/ui/cn";
import { toast } from "@/lib/toast";
import { rankForProjectAction, proposeMatch } from "@/lib/matches-actions";
import type { CandidateMatchHit } from "@/lib/candidate-project-match";

interface ProjectOption {
  id: string;
  titel: string | null;
  kunde: string | null;
  standort: string | null;
}

/** Search & Match: Projekt wählen → gerankte Kandidaten mit Score + Consent-Status. */
export function MatchWorkbench({ projects }: { projects: ProjectOption[] }) {
  const [projectId, setProjectId] = useState(projects[0]?.id ?? "");
  const [hits, setHits] = useState<CandidateMatchHit[]>([]);
  const [ran, setRan] = useState(false);
  const [pending, start] = useTransition();
  const [proposing, setProposing] = useState<string | null>(null);

  function run() {
    if (!projectId) return;
    start(async () => {
      const res = await rankForProjectAction(projectId);
      if (!res.ok) {
        toast.error(res.error ?? "Ranking fehlgeschlagen.");
        return;
      }
      setHits(res.hits);
      setRan(true);
    });
  }

  function propose(candidateId: string) {
    setProposing(candidateId);
    start(async () => {
      const res = await proposeMatch(candidateId, projectId);
      setProposing(null);
      if (res.ok) toast.success("Kandidat vorgeschlagen.");
      else toast.error(res.error ?? "Vorschlagen nicht möglich.");
    });
  }

  if (projects.length === 0) {
    return (
      <Card>
        <CardBody>
          <EmptyState
            icon={<IconAlertTriangle size={20} />}
            title="Noch keine Projekte gespiegelt. Starte zuerst den HubSpot-Sync (POST /api/hubspot/sync-projects), sobald der Token gesetzt ist."
          />
        </CardBody>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardBody className="space-y-3">
          <SectionHeader title="Projekt wählen" hint="HubSpot-Recruiting-Projekt (read-only Spiegel)" />
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={projectId}
              onChange={(e) => setProjectId(e.target.value)}
              className="min-w-0 flex-1 rounded-xl border border-border bg-surface px-3 py-2 text-sm text-ink focus-visible:ring-2 focus-visible:ring-brand"
            >
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {[p.titel || "Projekt", p.kunde, p.standort].filter(Boolean).join(" · ")}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={run}
              disabled={pending || !projectId}
              className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-brand to-sky px-4 py-2 text-sm font-semibold text-white shadow-glow active:scale-95 disabled:opacity-60"
            >
              {pending ? "Matche …" : "Kandidaten matchen"}
            </button>
          </div>
        </CardBody>
      </Card>

      {ran ? (
        <Card>
          <CardBody>
            <SectionHeader
              title={`Treffer (${hits.length})`}
              hint="Score aus Skills · Standort · Verfügbarkeit"
            />
            {hits.length === 0 ? (
              <EmptyState title="Keine passenden Kandidaten gefunden." />
            ) : (
              <ul className="divide-y divide-border">
                {hits.map((h) => (
                  <li key={h.candidateId} className="flex items-center gap-3 py-3">
                    <span
                      className={cn(
                        "flex h-10 w-10 flex-none items-center justify-center rounded-xl text-sm font-black",
                        h.score >= 60 ? "bg-success/15 text-success" : h.score >= 30 ? "bg-warning/15 text-warning" : "bg-elevated text-faint"
                      )}
                    >
                      {h.score}
                    </span>
                    <div className="min-w-0 flex-1">
                      <Link
                        href={`/cockpit/kandidaten/${h.candidateId}`}
                        className="truncate text-sm font-semibold text-ink hover:text-brand-deep hover:underline"
                      >
                        {h.name}
                      </Link>
                      <p className="truncate text-xs text-faint">{h.reasons.join(" · ") || "—"}</p>
                    </div>
                    {h.vorstellbar ? (
                      <Badge tone="success" size="sm" title="Gültige Einwilligung">
                        <IconCheck size={12} /> vorstellbar
                      </Badge>
                    ) : (
                      <Badge tone="warning" size="sm" title="Keine gültige Einwilligung">
                        <IconAlertTriangle size={12} /> Einwilligung fehlt
                      </Badge>
                    )}
                    <button
                      type="button"
                      onClick={() => propose(h.candidateId)}
                      disabled={pending || !h.vorstellbar}
                      title={h.vorstellbar ? "Diesem Projekt vorschlagen" : "Erst Einwilligung einholen"}
                      className="inline-flex flex-none items-center gap-1 rounded-lg border border-border bg-surface px-2.5 py-1.5 text-xs font-semibold text-ink hover:bg-elevated disabled:opacity-50"
                    >
                      {proposing === h.candidateId ? "…" : "Vorschlagen"}
                      <IconChevronRight size={13} />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>
      ) : null}
    </div>
  );
}
