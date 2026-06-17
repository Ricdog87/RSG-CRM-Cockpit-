import Link from "next/link";
import { Card, CardBody, SectionHeader } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Badge } from "@/components/ui/Badge";
import { IconCheck, IconClock } from "@/components/ui/icons";
import { formatDate, formatEur } from "@/lib/format";
import type { KiProject } from "@/lib/crm-types";

const WITHIN_DAYS = 60;

interface RenewalAlert {
  id: string;
  account: string;
  product: string;
  reason: "renewal" | "churn";
  date?: string;
  daysUntil?: number;
  churn?: "niedrig" | "mittel" | "hoch";
}

function daysUntil(iso?: string): number | null {
  if (!iso) return null;
  return Math.round((new Date(iso + "T00:00:00").getTime() - Date.now()) / 86400000);
}

function buildAlerts(projects: KiProject[]): { alerts: RenewalAlert[]; upsell: number } {
  const active = projects.filter((p) => p.status !== "gekuendigt");
  const alerts: RenewalAlert[] = [];
  for (const p of active) {
    const d = daysUntil(p.contract_end);
    const renewalSoon = d != null && d <= WITHIN_DAYS;
    const churnHigh = p.churn_risk === "hoch";
    if (renewalSoon || churnHigh) {
      alerts.push({
        id: p.id,
        account: p.account_name,
        product: p.product || "KI-Projekt",
        reason: renewalSoon ? "renewal" : "churn",
        date: p.contract_end,
        daysUntil: d ?? undefined,
        churn: p.churn_risk,
      });
    }
  }
  alerts.sort((a, b) => {
    const da = a.daysUntil ?? 9999;
    const db = b.daysUntil ?? 9999;
    return da - db;
  });
  const upsell = active.reduce((s, p) => s + (p.upsell_value ?? 0), 0);
  return { alerts, upsell };
}

function whenLabel(days?: number): { text: string; tone: string } {
  if (days == null) return { text: "", tone: "text-faint" };
  if (days < 0) return { text: `${Math.abs(days)} T überfällig`, tone: "text-danger" };
  if (days <= 14) return { text: `in ${days} T`, tone: "text-warning" };
  return { text: `in ${days} T`, tone: "text-muted" };
}

/** Dashboard-/KI-Kachel: anstehende Verlängerungen (<60 T) & Churn-Risiken. */
export function KiRenewals({ projects }: { projects: KiProject[] }) {
  const { alerts, upsell } = buildAlerts(projects);

  return (
    <Card>
      <CardBody>
        <SectionHeader
          title="Renewals & Churn"
          hint="Verlängerungen <60 T · Risiken"
          action={
            <Link
              href="/cockpit/projekte/ki"
              className="inline-flex items-center gap-1 text-xs font-semibold text-sky-deep hover:text-sky-ink"
            >
              KI-Projekte
            </Link>
          }
        />
        {alerts.length === 0 ? (
          <EmptyState icon={<IconCheck size={20} />} title="Keine anstehenden Verlängerungen oder Churn-Risiken." />
        ) : (
          <ul className="divide-y divide-border">
            {alerts.slice(0, 6).map((a) => {
              const w = whenLabel(a.daysUntil);
              return (
                <li key={`${a.id}-${a.reason}`} className="py-3 first:pt-0 last:pb-0">
                  <Link href={`/cockpit/projekte/ki/${a.id}`} className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-ink">
                        {a.account}
                        <span className="text-faint"> · {a.product}</span>
                      </p>
                      <p className="truncate text-xs text-muted">
                        {a.reason === "renewal"
                          ? `Verlängerung${a.date ? ` · ${formatDate(a.date)}` : ""}`
                          : "Churn-Risiko hoch"}
                      </p>
                    </div>
                    <div className="flex flex-none items-center gap-2">
                      {a.churn === "hoch" ? <Badge tone="danger">Churn</Badge> : null}
                      {a.daysUntil != null ? (
                        <span className={`flex items-center gap-1 text-xs font-semibold ${w.tone}`}>
                          <IconClock size={12} /> {w.text}
                        </span>
                      ) : null}
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
        {upsell > 0 ? (
          <p className="mt-3 border-t border-border/60 pt-2 text-xs text-muted">
            Upsell-Potenzial gesamt: <span className="font-semibold text-success">{formatEur(upsell)}/M</span>
          </p>
        ) : null}
      </CardBody>
    </Card>
  );
}
