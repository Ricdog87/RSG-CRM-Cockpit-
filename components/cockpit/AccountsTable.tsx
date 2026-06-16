import Link from "next/link";
import { Card, CardBody } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
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

/** Account-/Kundenliste (Customer Management). */
export function AccountsTable({
  accounts,
  renderActions,
}: {
  accounts: Account[];
  renderActions?: (a: Account) => React.ReactNode;
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
    <Card>
      <CardBody className="p-0 sm:p-0">
        <div className="hidden grid-cols-12 gap-3 border-b border-border px-5 py-3 text-xs font-medium uppercase tracking-wider text-faint lg:grid">
          <span className="col-span-3">Unternehmen</span>
          <span className="col-span-3">Kontakt</span>
          <span className="col-span-2">Segment</span>
          <span className="col-span-2">Phase</span>
          <span className="col-span-2 text-right">MRR</span>
        </div>

        <ul className="divide-y divide-border">
          {accounts.map((a) => {
            const lc = lifecycleMeta[a.lifecycle];
            return (
              <li
                key={a.id}
                className="px-4 py-4 lg:grid lg:grid-cols-12 lg:items-center lg:gap-3 lg:px-5 lg:py-3.5"
              >
                {/* Mobile layout */}
                <div className="flex items-start justify-between gap-3 lg:hidden">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Link
                        href={`/cockpit/kunden/${a.id}`}
                        className="text-sm font-semibold text-ink hover:text-brand-deep hover:underline"
                      >
                        {a.name}
                      </Link>
                      <LineBadge line={a.line} />
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
                    {renderActions ? renderActions(a) : null}
                  </div>
                </div>

                {/* Desktop layout */}
                <div className="col-span-3 hidden min-w-0 lg:block">
                  <div className="flex items-center gap-2">
                    <Link
                      href={`/cockpit/kunden/${a.id}`}
                      className="truncate text-sm font-semibold text-ink hover:text-brand-deep hover:underline"
                    >
                      {a.name}
                    </Link>
                    <LineBadge line={a.line} />
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
                      onClick={(e) => e.stopPropagation()}
                      className="truncate text-xs text-faint hover:text-brand"
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
                  {renderActions ? renderActions(a) : null}
                </div>
              </li>
            );
          })}
        </ul>
      </CardBody>
    </Card>
  );
}
