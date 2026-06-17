import Link from "next/link";
import { Card, CardBody, SectionHeader } from "@/components/ui/Card";
import { IconChevronRight } from "@/components/ui/icons";
import { formatEur } from "@/lib/format";
import type { InvoiceSummary } from "@/lib/invoices-data";

/** Dashboard-Kachel: Honorar-Rechnungen (offen, überfällig, bezahlt). */
export function InvoiceSummaryCard({ summary }: { summary: InvoiceSummary }) {
  return (
    <Card>
      <CardBody>
        <SectionHeader
          title="Rechnungen"
          hint="Honorar-Zahlstatus"
          action={
            <Link
              href="/cockpit/projekte/recruiting"
              className="inline-flex items-center gap-1 text-xs font-semibold text-sky-deep hover:text-sky-ink"
            >
              Mandate <IconChevronRight size={14} />
            </Link>
          }
        />
        <p className="text-3xl font-black tracking-tight text-ink">{formatEur(summary.outstanding)}</p>
        <p className="text-xs text-muted">offen (gestellt, noch nicht bezahlt)</p>

        <dl className="mt-4 space-y-2 border-t border-border/60 pt-3 text-xs">
          <div className="flex items-center justify-between gap-2">
            <dt className="text-faint">davon überfällig</dt>
            <dd className={summary.overdue > 0 ? "font-bold text-danger" : "font-medium text-ink"}>
              {formatEur(summary.overdue)}
            </dd>
          </div>
          <div className="flex items-center justify-between gap-2">
            <dt className="text-faint">bezahlt (Monat)</dt>
            <dd className="font-medium text-success">{formatEur(summary.paidThisMonth)}</dd>
          </div>
          <div className="flex items-center justify-between gap-2">
            <dt className="text-faint">Entwürfe (noch nicht gestellt)</dt>
            <dd className="font-medium text-ink">{formatEur(summary.draft)}</dd>
          </div>
        </dl>
      </CardBody>
    </Card>
  );
}
