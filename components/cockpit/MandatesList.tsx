import Link from "next/link";
import { Card, CardBody } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { IconUserCheck, IconChevronRight } from "@/components/ui/icons";
import { formatDate, formatEur } from "@/lib/format";
import type { MandateStatus, RecruitingMandate } from "@/lib/crm-types";

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

/** Liste der Recruiting-Mandate mit Besetzungsfortschritt. */
export function MandatesList({ mandates }: { mandates: RecruitingMandate[] }) {
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
        return (
          <Card key={m.id} className="card-hover">
            <CardBody className="space-y-4">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-ink">{m.role}</p>
                  <p className="truncate text-xs text-faint">{m.account_name}</p>
                </div>
                <Badge tone={st.tone}>{st.label}</Badge>
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

              <div className="flex items-center justify-between border-t border-border/60 pt-3 text-xs">
                <span className="inline-flex items-center gap-1.5 text-muted">
                  <IconUserCheck size={15} className="text-faint" />
                  {m.candidate_count} Kandidat:innen
                </span>
                <span className="text-faint">bis {formatDate(m.deadline)}</span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-ink">
                  {offen > 0 ? `${formatEur(offen * m.fee)} offen` : "vollständig besetzt"}
                </span>
                <Link
                  href="/cockpit/kandidaten"
                  className="inline-flex items-center gap-1 text-xs font-semibold text-sky-deep hover:text-sky-ink"
                >
                  Kandidaten <IconChevronRight size={14} />
                </Link>
              </div>
            </CardBody>
          </Card>
        );
      })}
    </div>
  );
}
