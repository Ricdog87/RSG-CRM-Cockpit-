import Link from "next/link";
import { getConsents, type ConsentRow } from "@/lib/consent-data";
import { PageHeader } from "@/components/cockpit/PageHeader";
import { StatCard } from "@/components/cockpit/StatCard";
import { Card, CardBody, SectionHeader } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { IconCheck, IconMail, IconAlert, IconChevronRight } from "@/components/ui/icons";
import { formatNumber, formatDate } from "@/lib/format";

export const dynamic = "force-dynamic";

const STATUS: Record<string, { label: string; tone: "success" | "sky" | "danger" | "neutral" }> = {
  granted: { label: "Erteilt", tone: "success" },
  pending: { label: "Angefragt", tone: "sky" },
  revoked: { label: "Widerrufen", tone: "danger" },
};

function isExpired(c: ConsentRow): boolean {
  return c.status === "pending" && !!c.expires_at && new Date(c.expires_at) < new Date();
}

export default async function EinwilligungenPage() {
  const consents = await getConsents();

  const granted = consents.filter((c) => c.status === "granted").length;
  const pending = consents.filter((c) => c.status === "pending").length;
  const revoked = consents.filter((c) => c.status === "revoked").length;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="DSGVO · Compliance"
        title="Einwilligungen"
        description="Übersicht aller Datenschutz-Einwilligungen deiner Kandidat:innen (Art. 6 Abs. 1 lit. a DSGVO) – angefragt, erteilt, widerrufen."
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Erteilt" value={formatNumber(granted)} hint="dokumentiert" accent="success" icon={IconCheck} />
        <StatCard label="Angefragt" value={formatNumber(pending)} hint="ausstehend" accent="sky" icon={IconMail} />
        <StatCard label="Widerrufen" value={formatNumber(revoked)} hint="zurückgezogen" accent="warning" icon={IconAlert} />
        <StatCard label="Gesamt" value={formatNumber(consents.length)} hint="Einwilligungs-Vorgänge" accent="brand" />
      </div>

      <Card>
        <CardBody>
          <SectionHeader title="Alle Einwilligungen" hint="neueste zuerst" />
          {consents.length === 0 ? (
            <EmptyState
              icon={<IconCheck size={22} />}
              title="Noch keine Einwilligungen. Fordere sie im Kandidatenprofil an (rechte Spalte DSGVO-Einwilligung)."
            />
          ) : (
            <ul className="divide-y divide-border">
              {consents.map((c) => {
                const st = STATUS[c.status] ?? STATUS.pending;
                const expired = isExpired(c);
                const date =
                  c.status === "granted"
                    ? c.granted_at
                    : c.status === "revoked"
                      ? c.revoked_at
                      : c.sent_at;
                return (
                  <li key={c.id}>
                    <Link
                      href={`/cockpit/kandidaten/${c.candidate_id}`}
                      className="group flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-ink group-hover:text-brand-deep">
                          {c.candidate_name}
                        </p>
                        <p className="truncate text-xs text-muted">
                          {c.candidate_email ?? c.email_to ?? "—"}
                        </p>
                      </div>
                      <div className="flex flex-none items-center gap-3">
                        {date ? (
                          <span className="hidden text-xs text-faint sm:inline">{formatDate(date)}</span>
                        ) : null}
                        <Badge tone={expired ? "warning" : st.tone}>
                          {expired ? "Abgelaufen" : st.label}
                        </Badge>
                        <IconChevronRight size={16} className="text-faint" />
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
