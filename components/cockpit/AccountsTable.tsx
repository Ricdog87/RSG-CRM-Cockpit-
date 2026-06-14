import { Card, CardBody } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { LineBadge } from "@/components/cockpit/LineBadge";
import { formatDate, formatEur } from "@/lib/format";
import type { Account, Lifecycle } from "@/lib/crm-types";

const lifecycleMeta: Record<
  Lifecycle,
  { label: string; tone: "neutral" | "cyan" | "purple" | "success" }
> = {
  lead: { label: "Lead", tone: "neutral" },
  opportunity: { label: "Opportunity", tone: "cyan" },
  kunde: { label: "Kunde", tone: "purple" },
  bestand: { label: "Bestand", tone: "success" },
};

/** Account-/Kundenliste (Customer Management). */
export function AccountsTable({ accounts }: { accounts: Account[] }) {
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
                className="grid grid-cols-2 gap-2 px-5 py-3.5 lg:grid-cols-12 lg:items-center lg:gap-3"
              >
                <div className="col-span-2 min-w-0 lg:col-span-3">
                  <div className="flex items-center gap-2">
                    <p className="truncate text-sm font-medium text-ink">{a.name}</p>
                    <LineBadge line={a.line} />
                  </div>
                  <p className="text-xs text-faint">
                    {a.branche} · {a.ort}
                  </p>
                </div>
                <div className="col-span-1 hidden min-w-0 lg:col-span-3 lg:block">
                  <p className="truncate text-sm text-muted">{a.contact_name}</p>
                  <p className="truncate text-xs text-faint">{a.contact_email}</p>
                </div>
                <div className="col-span-1 hidden min-w-0 lg:col-span-2 lg:block">
                  <p className="truncate text-sm text-muted">{a.segment}</p>
                </div>
                <div className="lg:col-span-2">
                  <Badge tone={lc.tone}>{lc.label}</Badge>
                </div>
                <div className="text-right lg:col-span-2">
                  <p className="text-sm font-semibold text-ink">
                    {a.mrr > 0 ? `${formatEur(a.mrr)}/M` : "—"}
                  </p>
                  <p className="text-xs text-faint">seit {formatDate(a.since)}</p>
                </div>
              </li>
            );
          })}
        </ul>
      </CardBody>
    </Card>
  );
}
