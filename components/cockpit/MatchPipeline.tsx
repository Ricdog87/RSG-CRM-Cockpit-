"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Card, CardBody, SectionHeader } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { MoveSelect } from "@/components/cockpit/MoveSelect";
import { BlindProfileButton } from "@/components/cockpit/BlindProfileButton";
import { IconTrash, IconChevronRight } from "@/components/ui/icons";
import { toast } from "@/lib/toast";
import { updateMatchStatus, deleteMatch } from "@/lib/matches-actions";
import { MATCH_STATUS_META, MATCH_STATUS_OPTIONS, type MatchStatus } from "@/lib/match-status";
import type { ProjectMatchGroup } from "@/lib/matches-data";

/**
 * Match-Pipeline: alle laufenden Matches je HubSpot-Projekt – Status steuern
 * (Vorgeschlagen → Geprüft → Vorgestellt → Platziert/Abgelehnt), Kandidat und
 * HubSpot-Deal direkt verlinkt.
 */
export function MatchPipeline({ groups }: { groups: ProjectMatchGroup[] }) {
  const router = useRouter();
  const [items, setItems] = useState(groups);
  useEffect(() => setItems(groups), [groups]);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  function patchMatch(matchId: string, patch: Partial<{ status: MatchStatus }>) {
    setItems((gs) =>
      gs.map((g) => ({
        ...g,
        matches: g.matches.map((m) => (m.id === matchId ? { ...m, ...patch } : m)),
      }))
    );
  }

  async function onMove(matchId: string, prev: MatchStatus, status: MatchStatus) {
    patchMatch(matchId, { status });
    const res = await updateMatchStatus(matchId, status);
    if (!res.ok) {
      patchMatch(matchId, { status: prev }); // Rollback
      toast.error(res.error ?? "Status-Wechsel fehlgeschlagen.");
    } else {
      router.refresh();
    }
  }

  async function onDelete(matchId: string) {
    const prev = items;
    setItems((gs) =>
      gs
        .map((g) => ({ ...g, matches: g.matches.filter((m) => m.id !== matchId) }))
        .filter((g) => g.matches.length > 0)
    );
    setConfirmDelete(null);
    const res = await deleteMatch(matchId);
    if (!res.ok) {
      setItems(prev); // Rollback
      toast.error(res.error ?? "Entfernen fehlgeschlagen.");
    } else {
      router.refresh();
    }
  }

  if (items.length === 0) {
    return (
      <Card>
        <CardBody>
          <EmptyState title="Noch keine Matches. Oben ein Projekt ranken und Kandidat:innen vorschlagen." />
        </CardBody>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {items.map((g) => (
        <Card key={g.projectRefId}>
          <CardBody>
            <SectionHeader
              title={g.titel}
              hint={[g.kunde, `${g.matches.length} Kandidat:in(nen) im Prozess`].filter(Boolean).join(" · ")}
              action={
                g.hubspotUrl ? (
                  <a
                    href={g.hubspotUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 rounded-lg border border-border bg-surface px-2.5 py-1.5 text-xs font-semibold text-ink hover:bg-elevated"
                  >
                    In HubSpot öffnen <IconChevronRight size={12} />
                  </a>
                ) : undefined
              }
            />
            <ul className="divide-y divide-border">
              {g.matches.map((m) => {
                const meta = MATCH_STATUS_META[m.status];
                return (
                  <li key={m.id} className="flex flex-wrap items-center gap-3 py-2.5">
                    {m.score != null ? (
                      <span className="flex h-8 w-8 flex-none items-center justify-center rounded-lg bg-elevated text-xs font-black text-muted">
                        {m.score}
                      </span>
                    ) : null}
                    <div className="min-w-0 flex-1">
                      <Link
                        href={`/cockpit/kandidaten/${m.candidateId}`}
                        className="truncate text-sm font-medium text-ink hover:text-brand-deep hover:underline"
                      >
                        {m.candidateName}
                      </Link>
                    </div>
                    <Badge tone={meta.tone} size="sm">
                      {meta.label}
                    </Badge>
                    <div className="w-44 flex-none">
                      <MoveSelect<MatchStatus>
                        value={m.status}
                        options={MATCH_STATUS_OPTIONS}
                        onMove={(next) => onMove(m.id, m.status, next)}
                      />
                    </div>
                    <BlindProfileButton candidateId={m.candidateId} />
                    {confirmDelete === m.id ? (
                      <span className="flex flex-none items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => onDelete(m.id)}
                          className="rounded-lg border border-danger/40 bg-danger/10 px-2 py-1 text-xs font-semibold text-danger hover:bg-danger/15"
                        >
                          Sicher?
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmDelete(null)}
                          className="rounded-lg px-1.5 py-1 text-xs text-muted hover:text-ink"
                        >
                          Nein
                        </button>
                      </span>
                    ) : (
                      <button
                        type="button"
                        aria-label="Match entfernen"
                        onClick={() => setConfirmDelete(m.id)}
                        className="flex-none rounded-lg p-1.5 text-faint hover:bg-danger/10 hover:text-danger"
                      >
                        <IconTrash size={14} />
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          </CardBody>
        </Card>
      ))}
    </div>
  );
}
