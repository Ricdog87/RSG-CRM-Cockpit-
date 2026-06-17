"use client";

import Link from "next/link";
import { useMemo } from "react";
import { Card, CardBody } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { IconBriefcase, IconUserCheck, IconChevronRight } from "@/components/ui/icons";
import { formatEur, formatDate } from "@/lib/format";
import {
  mandateRevenue,
  type MandateStatus,
  type RecruitingMandate,
  type Candidate,
} from "@/lib/crm-types";

const statusMeta: Record<MandateStatus, { label: string; tone: "neutral" | "sky" | "brand" | "success" | "warning" }> = {
  offen: { label: "Offen", tone: "neutral" },
  in_arbeit: { label: "In Arbeit", tone: "sky" },
  interviews: { label: "Interviews", tone: "brand" },
  besetzt: { label: "Besetzt", tone: "success" },
  pausiert: { label: "Pausiert", tone: "warning" },
};

interface CustomerGroup {
  account: string;
  mandates: RecruitingMandate[];
  openVolume: number;
  positions: number;
  filled: number;
}

/** Mandate je Kunde gebündelt – sauber getrennt mit Projektfortschritt. */
export function MandatesByCustomer({
  mandates,
  candidates = [],
  renderActions,
}: {
  mandates: RecruitingMandate[];
  candidates?: Candidate[];
  renderActions?: (m: RecruitingMandate) => React.ReactNode;
}) {
  const groups = useMemo<CustomerGroup[]>(() => {
    const map = new Map<string, CustomerGroup>();
    for (const m of mandates) {
      const key = m.account_name || "Ohne Kunde";
      const g = map.get(key) ?? { account: key, mandates: [], openVolume: 0, positions: 0, filled: 0 };
      g.mandates.push(m);
      const offen = Math.max(0, m.positions - m.filled);
      const perPos = m.positions > 0 ? mandateRevenue(m) / m.positions : 0;
      g.openVolume += offen * perPos;
      g.positions += m.positions;
      g.filled += m.filled;
      map.set(key, g);
    }
    return Array.from(map.values()).sort((a, b) => b.openVolume - a.openVolume);
  }, [mandates]);

  if (groups.length === 0) {
    return (
      <Card>
        <CardBody>
          <p className="py-6 text-center text-sm text-muted">Noch keine Mandate.</p>
        </CardBody>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {groups.map((g) => (
        <Card key={g.account}>
          <CardBody className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/60 pb-3">
              <div className="flex items-center gap-2.5">
                <span className="flex h-9 w-9 flex-none items-center justify-center rounded-xl bg-gradient-to-br from-brand to-sky text-white">
                  <IconBriefcase size={16} />
                </span>
                <div>
                  <p className="text-sm font-bold text-ink">{g.account}</p>
                  <p className="text-xs text-faint">
                    {g.mandates.length} Mandat{g.mandates.length === 1 ? "" : "e"} · {g.filled}/{g.positions} besetzt
                  </p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-sm font-bold text-ink">{formatEur(g.openVolume)}</p>
                <p className="text-[0.7rem] text-faint">offenes Volumen</p>
              </div>
            </div>

            <ul className="space-y-2">
              {g.mandates.map((m) => {
                const st = statusMeta[m.status] ?? statusMeta.offen;
                const offen = Math.max(0, m.positions - m.filled);
                const perPos = m.positions > 0 ? mandateRevenue(m) / m.positions : 0;
                const cands = candidates.filter(
                  (c) => c.mandate_id === m.id || c.mandate_account === m.account_name
                ).length;
                return (
                  <li key={m.id} className="flex items-center justify-between gap-3 rounded-xl border border-border bg-elevated/40 px-3 py-2.5">
                    <Link href={`/cockpit/projekte/recruiting/${m.id}`} className="group min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-ink group-hover:text-brand-deep">{m.role || "Mandat"}</p>
                      <p className="truncate text-xs text-faint">
                        <span className="inline-flex items-center gap-1"><IconUserCheck size={11} /> {cands}</span>
                        {" · "}{formatEur(offen * perPos)} offen · bis {formatDate(m.deadline)}
                      </p>
                    </Link>
                    <div className="flex flex-none items-center gap-1.5">
                      <Badge tone={st.tone}>{st.label}</Badge>
                      {renderActions ? renderActions(m) : <IconChevronRight size={16} className="text-faint" />}
                    </div>
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
