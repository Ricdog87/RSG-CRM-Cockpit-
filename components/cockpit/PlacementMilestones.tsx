import Link from "next/link";
import { Card, CardBody, SectionHeader } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { IconCheck, IconClock } from "@/components/ui/icons";
import { formatDate, formatEur } from "@/lib/format";
import type { PlacementMilestone } from "@/lib/placements-data";

function whenLabel(days: number): { text: string; tone: string } {
  if (days < 0) return { text: `${Math.abs(days)} T überfällig`, tone: "text-danger" };
  if (days === 0) return { text: "heute", tone: "text-warning" };
  if (days <= 7) return { text: `in ${days} T`, tone: "text-warning" };
  return { text: `in ${days} T`, tone: "text-muted" };
}

/** Dashboard-Kachel: anstehende Honorarraten (3 Mon.) & Garantie-Enden. */
export function PlacementMilestones({ milestones }: { milestones: PlacementMilestone[] }) {
  return (
    <Card>
      <CardBody>
        <SectionHeader
          title="Platzierungs-Meilensteine"
          hint="Honorarraten & Garantie-Enden"
        />
        {milestones.length === 0 ? (
          <EmptyState
            icon={<IconCheck size={20} />}
            title="Keine fälligen Meilensteine in den nächsten Wochen."
          />
        ) : (
          <ul className="divide-y divide-border">
            {milestones.slice(0, 6).map((ms, i) => {
              const w = whenLabel(ms.daysUntil);
              const p = ms.placement;
              return (
                <li key={`${p.id}-${ms.kind}-${i}`} className="py-3 first:pt-0 last:pb-0">
                  <Link
                    href={p.mandate_id ? `/cockpit/projekte/recruiting/${p.mandate_id}` : "/cockpit/projekte/recruiting"}
                    className="flex items-center justify-between gap-3"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-ink">
                        {p.candidate_name}
                        <span className="text-faint"> · {p.account_name || p.role}</span>
                      </p>
                      <p className="truncate text-xs text-muted">
                        {ms.kind === "split" ? (
                          <>
                            2. Honorarrate
                            {p.agreed_fee ? ` · ${formatEur(Math.round(p.agreed_fee / 2))}` : ""}
                          </>
                        ) : (
                          "Garantie-/Probezeit-Ende"
                        )}{" "}
                        · {formatDate(ms.date)}
                      </p>
                    </div>
                    <span className={`flex flex-none items-center gap-1 text-xs font-semibold ${w.tone}`}>
                      <IconClock size={12} /> {w.text}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </CardBody>
    </Card>
  );
}
