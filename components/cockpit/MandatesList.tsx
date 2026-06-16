"use client";

import { useState } from "react";
import Link from "next/link";
import { Card, CardBody } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { IconUserCheck, IconChevronRight } from "@/components/ui/icons";
import { formatDate, formatEur } from "@/lib/format";
import {
  mandateRevenue,
  type MandateStatus,
  type RecruitingMandate,
  type Candidate,
  type CandidateStage,
} from "@/lib/crm-types";

const statusMeta: Record<
  MandateStatus,
  { label: string; tone: "neutral" | "sky" | "brand" | "success" | "warning" }
> = {
  offen: { label: "Offen", tone: "neutral" },
  in_arbeit: { label: "In Arbeit", tone: "sky" },
  interviews: { label: "Interviews", tone: "brand" },
  besetzt: { label: "Besetzt", tone: "success" },
  pausiert: { label: "Pausiert", tone: "warning" },
};

const stageMeta: Record<
  CandidateStage,
  { label: string; tone: "neutral" | "sky" | "brand" | "success" | "warning" }
> = {
  neu: { label: "Neu", tone: "neutral" },
  screening: { label: "Screening", tone: "sky" },
  interview: { label: "Interview", tone: "brand" },
  angebot: { label: "Angebot", tone: "brand" },
  platziert: { label: "Platziert", tone: "success" },
  abgelehnt: { label: "Abgelehnt", tone: "warning" },
};

const STAGE_ORDER: CandidateStage[] = [
  "neu",
  "screening",
  "interview",
  "angebot",
  "platziert",
  "abgelehnt",
];

/** Liste der Recruiting-Mandate mit Besetzungsfortschritt und ausklappbarer Kandidaten-Pipeline. */
export function MandatesList({
  mandates,
  candidates = [],
  renderActions,
}: {
  mandates: RecruitingMandate[];
  candidates?: Candidate[];
  renderActions?: (m: RecruitingMandate) => React.ReactNode;
}) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  function toggle(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  if (mandates.length === 0) {
    return (
      <Card>
        <CardBody>
          <EmptyState title="Noch keine Mandate. Gewinne deinen ersten Recruiting-Auftrag, um ihn hier zu steuern." />
        </CardBody>
      </Card>
    );
  }

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {mandates.map((m) => {
        const st = statusMeta[m.status];
        const pct = m.positions > 0 ? Math.round((m.filled / m.positions) * 100) : 0;
        const offen = Math.max(0, m.positions - m.filled);
        const perPos = m.positions > 0 ? mandateRevenue(m) / m.positions : 0;
        const pricingLabel =
          m.pricing_model === "percent"
            ? `${m.fee_percent ?? 0} % von ${formatEur(m.target_salary ?? 0)}`
            : `Festpreis ${formatEur(m.fee)}`;

        // Kandidaten dieses Mandats
        const mandateCandidates = candidates.filter(
          (c) => c.mandate_id === m.id || c.mandate_account === m.account_name
        );
        const isExpanded = expanded.has(m.id);

        // Kandidaten nach Stage gruppieren
        const byStage: Partial<Record<CandidateStage, Candidate[]>> = {};
        for (const c of mandateCandidates) {
          if (!byStage[c.stage]) byStage[c.stage] = [];
          byStage[c.stage]!.push(c);
        }

        return (
          <Card key={m.id} className="card-hover">
            <CardBody className="space-y-4">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-ink">{m.role}</p>
                  <p className="truncate text-xs text-faint">{m.account_name}</p>
                </div>
                <div className="flex flex-none items-center gap-1">
                  <Badge tone={st.tone}>{st.label}</Badge>
                  {renderActions ? renderActions(m) : null}
                </div>
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-faint">Besetzung</span>
                  <span className="text-muted">
                    {m.filled} / {m.positions} Stellen
                  </span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-elevated">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-brand to-sky"
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>

              {/* Kandidaten-Toggle */}
              <div className="flex items-center justify-between border-t border-border/60 pt-3 text-xs">
                <button
                  type="button"
                  onClick={() => toggle(m.id)}
                  className="inline-flex items-center gap-1.5 text-muted transition-colors hover:text-ink"
                >
                  <IconUserCheck size={15} className="text-faint" />
                  Kandidaten ({mandateCandidates.length})
                  <IconChevronRight
                    size={13}
                    className={`text-faint transition-transform ${isExpanded ? "rotate-90" : ""}`}
                  />
                </button>
                <span className="text-faint">bis {formatDate(m.deadline)}</span>
              </div>

              {/* Ausklappbarer Kandidaten-Bereich */}
              {isExpanded && (
                <div className="space-y-3 border-t border-border/60 pt-3">
                  {mandateCandidates.length === 0 ? (
                    <p className="text-xs text-faint">Keine Kandidat:innen zugeordnet.</p>
                  ) : (
                    STAGE_ORDER.filter((s) => byStage[s]?.length).map((stage) => (
                      <div key={stage}>
                        <p className="mb-1.5 text-[0.65rem] font-semibold uppercase tracking-wider text-faint">
                          {stageMeta[stage].label} ({byStage[stage]!.length})
                        </p>
                        <div className="space-y-1">
                          {byStage[stage]!.map((c) => (
                            <Link
                              key={c.id}
                              href={`/cockpit/kandidaten/${c.id}`}
                              className="flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs hover:bg-elevated"
                            >
                              <Badge tone={stageMeta[stage].tone}>
                                {stageMeta[stage].label}
                              </Badge>
                              <span className="truncate font-medium text-ink">{c.name}</span>
                              {c.role ? (
                                <span className="truncate text-faint">· {c.role}</span>
                              ) : null}
                            </Link>
                          ))}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}

              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-ink">
                    {offen > 0 ? `${formatEur(offen * perPos)} offen` : "vollständig besetzt"}
                  </p>
                  <p className="truncate text-[0.7rem] text-faint">
                    {pricingLabel} · {formatEur(mandateRevenue(m))} gesamt
                  </p>
                </div>
                <Link
                  href={`/cockpit/projekte/recruiting/${m.id}`}
                  className="inline-flex flex-none items-center gap-1 text-xs font-semibold text-sky-deep hover:text-sky-ink"
                >
                  Pipeline <IconChevronRight size={14} />
                </Link>
              </div>
            </CardBody>
          </Card>
        );
      })}
    </div>
  );
}
