import { Card, CardBody } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { Button } from "@/components/ui/Button";
import { formatDate, formatEur } from "@/lib/format";
import type { CustomerRow, CustomerStatus } from "@/lib/types";

const statusMeta: Record<
  CustomerStatus,
  { label: string; tone: "success" | "cyan" | "warning" | "danger" }
> = {
  aktiv: { label: "Aktiv", tone: "success" },
  onboarding: { label: "Onboarding", tone: "cyan" },
  storno_reserve: { label: "Stornoreserve", tone: "warning" },
  gekuendigt: { label: "Gekündigt", tone: "danger" },
};

/** Kundenbestand als responsive Tabelle (Karten auf Mobile). */
export function CustomersTable({ customers }: { customers: CustomerRow[] }) {
  if (customers.length === 0) {
    return (
      <Card>
        <CardBody>
          <EmptyState
            title="Noch keine Kund:innen im Bestand. Schließe deinen ersten Deal ab, um deinen wiederkehrenden Bestand aufzubauen."
            action={<Button variant="ghost">Zur Pipeline</Button>}
          />
        </CardBody>
      </Card>
    );
  }

  return (
    <Card>
      <CardBody className="p-0 sm:p-0">
        {/* Tabellenkopf (nur Desktop) */}
        <div className="hidden grid-cols-12 gap-3 border-b border-border px-5 py-3 text-xs font-medium uppercase tracking-wider text-faint sm:grid">
          <span className="col-span-4">Kunde</span>
          <span className="col-span-3">Produkt</span>
          <span className="col-span-2 text-right">MRR</span>
          <span className="col-span-1 text-right">Prov.</span>
          <span className="col-span-2 text-right">Status</span>
        </div>

        <ul className="divide-y divide-border">
          {customers.map((c) => {
            const meta = statusMeta[c.status];
            const stornoLeft =
              c.status === "storno_reserve"
                ? Math.max(0, 6 - c.laufzeit_monate)
                : null;
            return (
              <li
                key={c.id}
                className="grid grid-cols-2 gap-2 px-5 py-3.5 sm:grid-cols-12 sm:items-center sm:gap-3"
              >
                <div className="col-span-2 min-w-0 sm:col-span-4">
                  <p className="truncate text-sm font-medium text-ink">{c.name}</p>
                  <p className="text-xs text-faint">seit {formatDate(c.since)}</p>
                </div>
                <div className="col-span-1 hidden min-w-0 sm:col-span-3 sm:block">
                  <p className="truncate text-sm text-muted">{c.product_name}</p>
                </div>
                <div className="text-left sm:col-span-2 sm:text-right">
                  <p className="text-sm font-semibold text-ink">
                    {formatEur(c.mrr)}/M
                  </p>
                  <p className="text-xs text-faint sm:hidden">{c.product_name}</p>
                </div>
                <div className="hidden text-right sm:col-span-1 sm:block">
                  <p className="text-sm text-cyan-soft">{formatEur(c.bestandsprovision)}</p>
                </div>
                <div className="flex items-center justify-end sm:col-span-2">
                  <div className="text-right">
                    <Badge tone={meta.tone}>{meta.label}</Badge>
                    {stornoLeft !== null ? (
                      <p className="mt-1 text-[0.7rem] text-warning">
                        Freigabe in {stornoLeft} Mon.
                      </p>
                    ) : null}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      </CardBody>
    </Card>
  );
}
