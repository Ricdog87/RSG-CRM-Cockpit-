import Link from "next/link";
import { Card, CardBody } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { TableCard, TableHead, TableBody, TableRow } from "@/components/ui/Table";
import { LineBadge } from "@/components/cockpit/LineBadge";
import { formatDate, formatEur } from "@/lib/format";
import type { Account, Lifecycle } from "@/lib/crm-types";

const lifecycleMeta: Record<
  Lifecycle,
  { label: string; tone: "neutral" | "sky" | "brand" | "success" }
> = {
  lead: { label: "Lead", tone: "neutral" },
  opportunity: { label: "Opportunity", tone: "sky" },
  kunde: { label: "Kunde", tone: "brand" },
  bestand: { label: "Bestand", tone: "success" },
};

const healthDot: Record<string, string> = {
  success: "bg-success",
  sky: "bg-sky",
  warning: "bg-warning",
  danger: "bg-danger",
};

function HealthPill({ info }: { info?: { score: number; tone: string; label: string } }) {
  if (!info) return null;
  return (
    <Badge tone="neutral" size="sm" title={`Health ${info.score}/100 · ${info.label}`} className="font-semibold">
      <span className={`h-1.5 w-1.5 flex-none rounded-full ${healthDot[info.tone] ?? "bg-elevated"}`} />
      {info.score}
    </Badge>
  );
}

// Feste Sortier-Richtung je Schlüssel (entspricht der Logik in AccountsView).
const SORT_DIR: Record<string, "asc" | "desc"> = {
  mrr: "desc",
  name: "asc",
  lifecycle: "asc",
  health: "asc",
};

/** Account-/Kundenliste (Customer Management). */
export function AccountsTable({
  accounts,
  renderActions,
  healthById = {},
  sort,
  onSort,
}: {
  accounts: Account[];
  renderActions?: (a: Account) => React.ReactNode;
  healthById?: Record<string, { score: number; tone: string; label: string }>;
  sort?: string;
  onSort?: (key: string) => void;
}) {
  if (accounts.length === 0) {
    return (
      <Card>
        <CardBody>
          <EmptyState title="Noch keine Accounts. Lege dein erstes Unternehmen an, um es hier zu verwalten." />
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
          { label: "Unternehmen", span: 3, sortKey: "name" },
          { label: "Kontakt", span: 3 },
          { label: "Segment", span: 2 },
          { label: "Phase", span: 2, sortKey: "lifecycle" },
          { label: "MRR", span: 2, align: "right", sortKey: "mrr" },
        ]}
      />
      <TableBody>
        {accounts.map((a) => {
          const lc = lifecycleMeta[a.lifecycle];
          return (
            <TableRow key={a.id} className="relative">
                {/* Ganze Zeile klickbar (Overlay-Link unter den interaktiven Elementen) */}
                <Link
                  href={`/cockpit/kunden/${a.id}`}
                  aria-label={`${a.name} öffnen`}
                  className="absolute inset-0 z-10"
                />
                {/* Mobile layout */}
                <div className="flex items-start justify-between gap-3 lg:hidden">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Link
                        href={`/cockpit/kunden/${a.id}`}
                        className="relative z-20 text-sm font-semibold text-ink hover:text-brand-deep hover:underline"
                      >
                        {a.name}
                      </Link>
                      <LineBadge line={a.line} />
                      <HealthPill info={healthById[a.id]} />
                      {a.synthetic ? <Badge tone="neutral">abgeleitet</Badge> : null}
                    </div>
                    {a.contact_name ? (
                      <p className="mt-0.5 truncate text-xs text-muted">{a.contact_name}</p>
                    ) : null}
                    <p className="mt-0.5 truncate text-xs text-faint">
                      {a.branche} · {a.ort}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <Badge tone={lc.tone}>{lc.label}</Badge>
                    {a.mrr > 0 ? (
                      <p className="text-sm font-semibold text-ink">{formatEur(a.mrr)}/M</p>
                    ) : null}
                    {renderActions ? <span className="relative z-20">{renderActions(a)}</span> : null}
                  </div>
                </div>

                {/* Desktop layout */}
                <div className="col-span-3 hidden min-w-0 lg:block">
                  <div className="flex items-center gap-2">
                    <Link
                      href={`/cockpit/kunden/${a.id}`}
                      className="relative z-20 truncate text-sm font-semibold text-ink hover:text-brand-deep hover:underline"
                    >
                      {a.name}
                    </Link>
                    <LineBadge line={a.line} />
                    <HealthPill info={healthById[a.id]} />
                    {a.synthetic ? <Badge tone="neutral">abgeleitet</Badge> : null}
                  </div>
                  <p className="truncate text-xs text-faint">
                    {a.branche} · {a.ort}
                  </p>
                </div>
                <div className="col-span-3 hidden min-w-0 lg:block">
                  <p className="truncate text-sm text-muted">{a.contact_name}</p>
                  {a.contact_phone ? (
                    <a
                      href={`tel:${a.contact_phone.replace(/\s+/g, "")}`}
                      className="relative z-20 truncate text-xs text-faint hover:text-brand"
                    >
                      {a.contact_phone}
                    </a>
                  ) : (
                    <p className="truncate text-xs text-faint">{a.contact_email}</p>
                  )}
                </div>
                <div className="col-span-2 hidden min-w-0 lg:block">
                  <p className="truncate text-sm text-muted">{a.segment}</p>
                </div>
                <div className="hidden lg:col-span-2 lg:block">
                  <Badge tone={lc.tone}>{lc.label}</Badge>
                </div>
                <div className="hidden items-center justify-end gap-2 lg:col-span-2 lg:flex">
                  <div className="text-right">
                    <p className="text-sm font-semibold text-ink">
                      {a.mrr > 0 ? `${formatEur(a.mrr)}/M` : "—"}
                    </p>
                    <p className="text-xs text-faint">seit {formatDate(a.since)}</p>
                  </div>
                  {renderActions ? <span className="relative z-20">{renderActions(a)}</span> : null}
                </div>
            </TableRow>
          );
        })}
      </TableBody>
    </TableCard>
  );
}
