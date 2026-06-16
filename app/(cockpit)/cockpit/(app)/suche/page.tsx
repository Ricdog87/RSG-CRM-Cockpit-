import Link from "next/link";
import {
  getAccounts,
  getOpportunities,
  getCandidates,
  getMandates,
} from "@/lib/crm-data";
import { PageHeader } from "@/components/cockpit/PageHeader";
import { Card, CardBody, SectionHeader } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { IconChevronRight } from "@/components/ui/icons";

export const dynamic = "force-dynamic";

interface Hit {
  href: string;
  title: string;
  subtitle: string;
}

function candNo(n?: number): string {
  return n != null ? `RSG-${String(n).padStart(5, "0")}` : "";
}

function match(q: string, ...fields: (string | undefined)[]) {
  return fields.some((f) => (f ?? "").toLowerCase().includes(q));
}

function ResultGroup({ label, hits }: { label: string; hits: Hit[] }) {
  if (hits.length === 0) return null;
  return (
    <Card>
      <CardBody>
        <SectionHeader title={label} hint={`${hits.length} Treffer`} />
        <ul className="divide-y divide-border">
          {hits.map((h, i) => (
            <li key={i}>
              <Link
                href={h.href}
                className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0 hover:opacity-80"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-ink">{h.title}</p>
                  <p className="truncate text-xs text-muted">{h.subtitle}</p>
                </div>
                <IconChevronRight size={16} className="flex-none text-faint" />
              </Link>
            </li>
          ))}
        </ul>
      </CardBody>
    </Card>
  );
}

export default async function SuchePage({
  searchParams,
}: {
  searchParams: { q?: string };
}) {
  const q = (searchParams.q ?? "").trim().toLowerCase();

  if (!q) {
    return (
      <div className="space-y-6">
        <PageHeader eyebrow="Suche" title="CRM-Suche" />
        <EmptyState title="Gib oben einen Suchbegriff ein – Kunden, Chancen, Kandidaten und Mandate werden durchsucht." />
      </div>
    );
  }

  const [accounts, opportunities, candidates, mandates] = await Promise.all([
    getAccounts(),
    getOpportunities(),
    getCandidates(),
    getMandates(),
  ]);

  const accountHits: Hit[] = accounts
    .filter((a) => match(q, a.name, a.branche, a.contact_name, a.segment, a.ort))
    .map((a) => ({
      href: `/cockpit/kunden/${a.id}`,
      title: a.name,
      subtitle: [a.branche, a.contact_name].filter(Boolean).join(" · ") || a.line,
    }));

  const oppHits: Hit[] = opportunities
    .filter((o) => match(q, o.account_name, o.title, o.owner))
    .map((o) => ({
      href: "/cockpit/sales",
      title: o.title || o.account_name,
      subtitle: `${o.account_name} · ${o.stage}`,
    }));

  const candHits: Hit[] = candidates
    .filter((c) =>
      match(q, c.name, c.role, c.mandate_account, c.source, candNo(c.candidate_no), String(c.candidate_no ?? ""))
    )
    .map((c) => ({
      href: `/cockpit/kandidaten/${c.id}`,
      title: [c.title, c.name].filter(Boolean).join(" "),
      subtitle: [candNo(c.candidate_no), c.role, c.mandate_account].filter(Boolean).join(" · "),
    }));

  const mandateHits: Hit[] = mandates
    .filter((m) => match(q, m.account_name, m.role))
    .map((m) => ({
      href: "/cockpit/projekte/recruiting",
      title: m.role,
      subtitle: `${m.account_name} · ${m.status}`,
    }));

  const total =
    accountHits.length + oppHits.length + candHits.length + mandateHits.length;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Suche"
        title={`Ergebnisse für „${searchParams.q}"`}
        description={`${total} Treffer über Kunden, Chancen, Kandidaten und Mandate.`}
        action={<Badge tone="neutral">{total}</Badge>}
      />

      {total === 0 ? (
        <EmptyState title="Keine Treffer. Versuche einen anderen Begriff – z.B. einen Firmen- oder Personennamen." />
      ) : (
        <div className="space-y-6">
          <ResultGroup label="Kunden" hits={accountHits} />
          <ResultGroup label="Verkaufschancen" hits={oppHits} />
          <ResultGroup label="Kandidaten" hits={candHits} />
          <ResultGroup label="Mandate" hits={mandateHits} />
        </div>
      )}
    </div>
  );
}
