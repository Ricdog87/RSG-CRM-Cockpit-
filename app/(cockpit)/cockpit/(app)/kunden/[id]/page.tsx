import Link from "next/link";
import { notFound } from "next/navigation";
import { getAccountDetail } from "@/lib/crm-data";
import { getEmailActivitiesForAccount } from "@/lib/email-data";
import { EmailTimeline } from "@/components/cockpit/EmailTimeline";
import { Card, CardBody, SectionHeader } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { LineBadge } from "@/components/cockpit/LineBadge";
import { EmptyState } from "@/components/ui/EmptyState";
import { IconChevronRight } from "@/components/ui/icons";
import { AccountEnrich } from "@/components/cockpit/AccountEnrich";
import { formatDate, formatEur, formatPercent } from "@/lib/format";

export const dynamic = "force-dynamic";

const lifecycleLabel: Record<string, string> = {
  lead: "Lead",
  opportunity: "Opportunity",
  kunde: "Kunde",
  bestand: "Bestand",
};

function Row({
  title,
  subtitle,
  right,
  badge,
}: {
  title: string;
  subtitle?: string;
  right?: string;
  badge?: React.ReactNode;
}) {
  return (
    <li className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
      <div className="min-w-0">
        <p className="truncate text-sm font-medium text-ink">{title}</p>
        {subtitle ? <p className="truncate text-xs text-muted">{subtitle}</p> : null}
      </div>
      <div className="flex flex-none items-center gap-3">
        {right ? <span className="text-sm font-semibold text-ink">{right}</span> : null}
        {badge}
      </div>
    </li>
  );
}

export default async function AccountDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const detail = await getAccountDetail(params.id);
  if (!detail) notFound();
  const { account, opportunities, kiProjects, mandates, candidates } = detail;
  const emails = await getEmailActivitiesForAccount(account.id, account.name);

  return (
    <div className="space-y-6">
      <Link
        href="/cockpit/kunden"
        className="inline-flex items-center gap-1 text-sm text-muted hover:text-ink"
      >
        <IconChevronRight size={14} className="rotate-180" /> Zurück zu Kunden
      </Link>

      {/* Kopf */}
      <Card>
        <CardBody className="space-y-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-xl font-bold text-ink sm:text-2xl">{account.name}</h1>
                <LineBadge line={account.line} />
                <Badge tone="sky">{lifecycleLabel[account.lifecycle] ?? account.lifecycle}</Badge>
              </div>
              <p className="mt-1 text-sm text-muted">
                {[account.branche, account.ort].filter(Boolean).join(" · ") || "—"}
              </p>
            </div>
            <div className="text-right">
              <p className="text-2xl font-bold text-ink">
                {account.mrr > 0 ? `${formatEur(account.mrr)}/M` : "—"}
              </p>
              <p className="text-xs text-faint">wiederkehrender Umsatz</p>
            </div>
          </div>

          <div className="grid gap-3 border-t border-border/60 pt-4 sm:grid-cols-3">
            <div>
              <p className="kpi-label">Ansprechpartner:in</p>
              <p className="mt-1 text-sm text-ink">{account.contact_name || "—"}</p>
            </div>
            <div>
              <p className="kpi-label">E-Mail</p>
              <p className="mt-1 truncate text-sm text-ink">{account.contact_email || "—"}</p>
            </div>
            <div>
              <p className="kpi-label">Segment</p>
              <p className="mt-1 text-sm text-ink">{account.segment || "—"}</p>
            </div>
          </div>
        </CardBody>
      </Card>

      {/* KI-Analyse des Accounts */}
      <AccountEnrich
        company={account.name}
        domain={account.contact_email ? account.contact_email.split("@")[1] : undefined}
        notes={[account.branche, account.segment, account.ort]
          .filter(Boolean)
          .join(" · ")}
      />

      {/* Korrespondenz (BCC-getrackte E-Mails) */}
      <Card>
        <CardBody>
          <SectionHeader
            title="Korrespondenz"
            hint="per BCC automatisch getrackte E-Mails"
          />
          <EmailTimeline
            activities={emails}
            emptyText="Noch keine E-Mails. Setze deine BCC-Adresse (Postfach) ins BCC, um Mails automatisch hier zu protokollieren."
          />
        </CardBody>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Verkaufschancen */}
        <Card>
          <CardBody>
            <SectionHeader title="Verkaufschancen" hint={`${opportunities.length} verknüpft`} />
            {opportunities.length === 0 ? (
              <EmptyState title="Keine offenen Chancen für diesen Account." />
            ) : (
              <ul className="divide-y divide-border">
                {opportunities.map((o) => (
                  <Row
                    key={o.id}
                    title={o.title || o.account_name}
                    subtitle={`${o.owner} · ${formatDate(o.expected_close)}`}
                    right={
                      o.value_type === "mrr" ? `${formatEur(o.value)}/M` : formatEur(o.value)
                    }
                    badge={<Badge tone="brand">{formatPercent(o.probability)}</Badge>}
                  />
                ))}
              </ul>
            )}
          </CardBody>
        </Card>

        {/* KI-Projekte */}
        <Card>
          <CardBody>
            <SectionHeader title="KI-Projekte" hint={`${kiProjects.length} aktiv`} />
            {kiProjects.length === 0 ? (
              <EmptyState title="Kein KI-Projekt für diesen Account." />
            ) : (
              <ul className="divide-y divide-border">
                {kiProjects.map((p) => (
                  <Row
                    key={p.id}
                    title={p.product || "KI-Projekt"}
                    subtitle={`Go-Live ${formatDate(p.go_live)}`}
                    right={`${formatEur(p.mrr)}/M`}
                    badge={<Badge tone="sky">{p.status}</Badge>}
                  />
                ))}
              </ul>
            )}
          </CardBody>
        </Card>

        {/* Mandate */}
        <Card>
          <CardBody>
            <SectionHeader title="Recruiting-Mandate" hint={`${mandates.length} verknüpft`} />
            {mandates.length === 0 ? (
              <EmptyState title="Kein Mandat für diesen Account." />
            ) : (
              <ul className="divide-y divide-border">
                {mandates.map((m) => (
                  <Row
                    key={m.id}
                    title={m.role}
                    subtitle={`${m.filled}/${m.positions} besetzt · bis ${formatDate(m.deadline)}`}
                    right={formatEur(m.fee)}
                    badge={<Badge tone="brand">{m.status}</Badge>}
                  />
                ))}
              </ul>
            )}
          </CardBody>
        </Card>

        {/* Kandidaten */}
        <Card>
          <CardBody>
            <SectionHeader title="Kandidaten" hint={`${candidates.length} im Prozess`} />
            {candidates.length === 0 ? (
              <EmptyState title="Keine Kandidat:innen für diesen Account." />
            ) : (
              <ul className="divide-y divide-border">
                {candidates.map((c) => (
                  <Row
                    key={c.id}
                    title={c.name}
                    subtitle={c.role}
                    badge={<Badge tone="sky">{c.stage}</Badge>}
                  />
                ))}
              </ul>
            )}
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
