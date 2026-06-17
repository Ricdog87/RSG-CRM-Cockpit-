import Link from "next/link";
import { Card, CardBody } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { formatDate, formatEur } from "@/lib/format";
import type { Health, KiProject, KiStatus } from "@/lib/crm-types";

const statusMeta: Record<
  KiStatus,
  { label: string; tone: "sky" | "success" | "brand" | "warning" | "danger" }
> = {
  onboarding: { label: "Onboarding", tone: "sky" },
  live: { label: "Live", tone: "success" },
  optimierung: { label: "Optimierung", tone: "brand" },
  pausiert: { label: "Pausiert", tone: "warning" },
  gekuendigt: { label: "Gekündigt", tone: "danger" },
};

const healthMeta: Record<Health, { label: string; tone: "success" | "neutral" | "danger" }> = {
  gut: { label: "Gesund", tone: "success" },
  neutral: { label: "Stabil", tone: "neutral" },
  risiko: { label: "Risiko", tone: "danger" },
};

/** Projekttabelle für KI- & Telefonassistenz-Projekte. */
export function KiProjectsTable({
  projects,
  renderActions,
}: {
  projects: KiProject[];
  renderActions?: (p: KiProject) => React.ReactNode;
}) {
  if (projects.length === 0) {
    return (
      <Card>
        <CardBody>
          <EmptyState title="Noch keine KI-Projekte. Sobald ein Deal aktiviert wird, erscheint das Projekt hier." />
        </CardBody>
      </Card>
    );
  }

  return (
    <Card>
      <CardBody className="p-0 sm:p-0">
        <div className="hidden grid-cols-12 gap-3 border-b border-border px-5 py-3 text-xs font-medium uppercase tracking-wider text-faint lg:grid">
          <span className="col-span-4">Projekt</span>
          <span className="col-span-2">Segment</span>
          <span className="col-span-2">Status</span>
          <span className="col-span-2">Health</span>
          <span className="col-span-2 text-right">MRR</span>
        </div>
        <ul className="divide-y divide-border">
          {projects.map((p) => {
            const st = statusMeta[p.status];
            const he = healthMeta[p.health];
            return (
              <li
                key={p.id}
                className="relative grid grid-cols-2 gap-2 px-5 py-3.5 transition-colors hover:bg-elevated/40 lg:grid-cols-12 lg:items-center lg:gap-3"
              >
                <Link
                  href={`/cockpit/projekte/ki/${p.id}`}
                  aria-label={`${p.account_name} öffnen`}
                  className="absolute inset-0 z-10"
                />
                <div className="col-span-2 min-w-0 lg:col-span-4">
                  <p className="truncate text-sm font-medium text-ink">{p.account_name}</p>
                  <p className="truncate text-xs text-faint">
                    {p.product} · Go-Live {formatDate(p.go_live)}
                  </p>
                </div>
                <div className="hidden min-w-0 lg:col-span-2 lg:block">
                  <p className="truncate text-sm text-muted">{p.segment}</p>
                </div>
                <div className="lg:col-span-2">
                  <Badge tone={st.tone}>{st.label}</Badge>
                </div>
                <div className="lg:col-span-2">
                  <Badge tone={he.tone}>{he.label}</Badge>
                </div>
                <div className="relative z-20 flex items-center justify-end gap-2 lg:col-span-2">
                  <div className="text-right">
                    <p className="text-sm font-semibold text-ink">{formatEur(p.mrr)}/M</p>
                    {p.setup_fee ? (
                      <p className="text-[0.7rem] text-faint">+ {formatEur(p.setup_fee)} Setup</p>
                    ) : null}
                  </div>
                  {renderActions ? renderActions(p) : null}
                </div>
              </li>
            );
          })}
        </ul>
      </CardBody>
    </Card>
  );
}
