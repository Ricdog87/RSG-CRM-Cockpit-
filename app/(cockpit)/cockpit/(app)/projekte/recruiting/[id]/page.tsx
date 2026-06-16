import Link from "next/link";
import { notFound } from "next/navigation";
import { getMandates, getCandidates } from "@/lib/crm-data";
import { mandateRevenue } from "@/lib/crm-types";
import { Card, CardBody, SectionHeader } from "@/components/ui/Card";
import { StatCard } from "@/components/cockpit/StatCard";
import { Badge } from "@/components/ui/Badge";
import { MandateCandidates } from "@/components/cockpit/MandateCandidates";
import { MandateMatchPanel } from "@/components/cockpit/MandateMatchPanel";
import { IconChevronRight, IconBriefcase, IconUserCheck, IconEuro, IconTarget } from "@/components/ui/icons";
import { formatEur, formatNumber, formatDate } from "@/lib/format";
import type { MandateStatus } from "@/lib/crm-types";

export const dynamic = "force-dynamic";

const statusMeta: Record<MandateStatus, { label: string; tone: "neutral" | "sky" | "brand" | "success" | "warning" }> = {
  offen: { label: "Offen", tone: "neutral" },
  in_arbeit: { label: "In Arbeit", tone: "sky" },
  interviews: { label: "Interviews", tone: "brand" },
  besetzt: { label: "Besetzt", tone: "success" },
  pausiert: { label: "Pausiert", tone: "warning" },
};

export default async function MandateDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const [mandates, candidates] = await Promise.all([getMandates(), getCandidates()]);
  const m = mandates.find((x) => x.id === params.id);
  if (!m) notFound();

  const list = candidates.filter((c) => c.mandate_id === m.id);
  const st = statusMeta[m.status] ?? statusMeta.offen;
  const offen = Math.max(0, m.positions - m.filled);
  const perPos = m.positions > 0 ? mandateRevenue(m) / m.positions : 0;
  const pricingLabel =
    m.pricing_model === "percent"
      ? `${m.fee_percent ?? 0} % von ${formatEur(m.target_salary ?? 0)} Zielgehalt`
      : `Festpreis ${formatEur(m.fee)} je Stelle`;

  return (
    <div className="space-y-6">
      <nav className="flex items-center gap-1.5 text-sm text-muted">
        <Link href="/cockpit/projekte/recruiting" className="hover:text-ink">
          Personalvermittlung
        </Link>
        <IconChevronRight size={14} className="text-faint" />
        <span className="truncate text-ink">{m.role || "Mandat"}</span>
      </nav>

      <Card>
        <CardBody>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <span className="flex h-12 w-12 flex-none items-center justify-center rounded-2xl bg-gradient-to-br from-brand to-sky text-white">
                <IconBriefcase size={22} />
              </span>
              <div className="min-w-0">
                <h1 className="text-xl font-bold text-ink">{m.role || "Mandat"}</h1>
                <p className="text-sm text-muted">{m.account_name}</p>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <Badge tone={st.tone}>{st.label}</Badge>
                  <Badge tone="neutral">{pricingLabel}</Badge>
                  {m.deadline ? <Badge tone="sky">bis {formatDate(m.deadline)}</Badge> : null}
                </div>
              </div>
            </div>
          </div>
        </CardBody>
      </Card>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Stellen" value={formatNumber(m.positions)} hint={`${formatNumber(offen)} offen`} accent="brand" icon={IconBriefcase} />
        <StatCard label="Besetzt" value={formatNumber(m.filled)} hint="erfolgreich" accent="success" icon={IconUserCheck} />
        <StatCard label="Kandidat:innen" value={formatNumber(list.length)} hint="zugeordnet" accent="sky" icon={IconTarget} />
        <StatCard label="Erwarteter Umsatz" value={formatEur(mandateRevenue(m))} hint={`${formatEur(offen * perPos)} offen`} accent="warning" icon={IconEuro} />
      </div>

      <Card className="border-brand/30 bg-gradient-to-br from-brand/[0.05] to-sky/[0.04]">
        <CardBody>
          <SectionHeader
            title="Search & Match"
            hint="passende Kandidat:innen per Algorithmus finden"
            action={<Badge tone="brand">Champions League</Badge>}
          />
          <MandateMatchPanel mandateId={m.id} />
        </CardBody>
      </Card>

      <Card>
        <CardBody>
          <SectionHeader title="Kandidaten-Pipeline" hint="Status je Phase – per Auswahl verschieben" />
          <MandateCandidates candidates={list} />
        </CardBody>
      </Card>
    </div>
  );
}
