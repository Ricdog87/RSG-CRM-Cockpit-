import Link from "next/link";
import { Card, CardBody } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { TableCard, TableHead, TableBody, TableRow } from "@/components/ui/Table";
import { formatDate, formatEur } from "@/lib/format";
import type { Health, KiProject, KiStatus } from "@/lib/crm-types";

const statusMeta: Record<
  KiStatus,
  { label: string; tone: "neutral" | "sky" | "success" | "brand" | "warning" | "danger" }
> = {
  angebot: { label: "Angebot", tone: "neutral" },
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

// Feste Sortier-Richtung je Schlüssel (entspricht der Logik in KiProjectsView).
const SORT_DIR: Record<string, "asc" | "desc"> = {
  mrr: "desc",
  name: "asc",
  status: "asc",
};

/** Projekttabelle für KI- & Telefonassistenz-Projekte. */
export function KiProjectsTable({
  projects,
  renderActions,
  sort,
  onSort,
}: {
  projects: KiProject[];
  renderActions?: (p: KiProject) => React.ReactNode;
  sort?: string;
  onSort?: (key: string) => void;
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
    <TableCard>
      <TableHead
        sort={sort}
        sortDir={sort ? SORT_DIR[sort] : undefined}
        onSort={onSort}
        columns={[
          { label: "Projekt", span: 4, sortKey: "name" },
          { label: "Segment", span: 2 },
          { label: "Status", span: 2, sortKey: "status" },
          { label: "Health", span: 2 },
          { label: "MRR", span: 2, align: "right", sortKey: "mrr" },
        ]}
      />
      <TableBody>
        {projects.map((p) => {
          const st = statusMeta[p.status];
          const he = healthMeta[p.health];
          return (
            <TableRow key={p.id} className="relative grid grid-cols-2 gap-2 lg:grid-cols-12">
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
            </TableRow>
          );
        })}
      </TableBody>
    </TableCard>
  );
}
