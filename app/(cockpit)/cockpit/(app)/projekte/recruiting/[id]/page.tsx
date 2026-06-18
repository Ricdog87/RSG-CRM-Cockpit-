import Link from "next/link";
import { notFound } from "next/navigation";
import { getMandates, getCandidates, getAccounts, accountKey } from "@/lib/crm-data";
import { getPlacementsForMandate } from "@/lib/placements-data";
import { getInvoicesForMandate } from "@/lib/invoices-data";
import { getJobResponsesForMandate } from "@/lib/submissions-data";
import { mandateRevenue } from "@/lib/crm-types";
import { Card, CardBody, SectionHeader } from "@/components/ui/Card";
import { StatCard } from "@/components/cockpit/StatCard";
import { Badge } from "@/components/ui/Badge";
import { MandateCandidates } from "@/components/cockpit/MandateCandidates";
import { MandateMatchPanel } from "@/components/cockpit/MandateMatchPanel";
import { MandateIntelCard } from "@/components/cockpit/MandateIntelCard";
import { MandateProposalButton } from "@/components/cockpit/MandateProposalButton";
import { PlacementContractDialog } from "@/components/cockpit/PlacementContractDialog";
import { computeMandateIntel } from "@/lib/mandate-intel";
import { JobPostingCard } from "@/components/cockpit/JobPostingCard";
import { PlacementsCard } from "@/components/cockpit/PlacementsCard";
import { InvoicesCard } from "@/components/cockpit/InvoicesCard";
import { IconChevronRight, IconBriefcase, IconUserCheck, IconEuro, IconTarget } from "@/components/ui/icons";
import { formatEur, formatNumber, formatDate } from "@/lib/format";
import type { MandateStatus } from "@/lib/crm-types";

export const dynamic = "force-dynamic";

const statusMeta: Record<MandateStatus, { label: string; tone: "neutral" | "sky" | "brand" | "success" | "warning" }> = {
  angebot: { label: "Angebot / Planung", tone: "neutral" },
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
  const [mandates, candidates, accounts, placements, invoices, jobResponses] = await Promise.all([
    getMandates(),
    getCandidates(),
    getAccounts(),
    getPlacementsForMandate(params.id),
    getInvoicesForMandate(params.id),
    getJobResponsesForMandate(params.id),
  ]);
  const m = mandates.find((x) => x.id === params.id);
  if (!m) notFound();
  const account = accounts.find((a) => accountKey(a.name) === accountKey(m.account_name));

  const list = candidates.filter((c) => c.mandate_id === m.id);
  // Platzierungen ohne erzeugte Rechnungen → „aus Plan erzeugen".
  const invoicedPlacementIds = new Set(invoices.map((i) => i.placement_id).filter(Boolean));
  const placementsToInvoice = placements
    .filter((p) => !invoicedPlacementIds.has(p.id))
    .map((p) => ({ id: p.id, label: p.candidate_name }));
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
                {account ? (
                  <Link href={`/cockpit/kunden/${account.id}`} className="text-sm text-muted hover:text-brand-deep">
                    {m.account_name}
                  </Link>
                ) : (
                  <p className="text-sm text-muted">{m.account_name}</p>
                )}
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <Badge tone={st.tone}>{st.label}</Badge>
                  <Badge tone="neutral">{pricingLabel}</Badge>
                  {m.deadline ? <Badge tone="sky">bis {formatDate(m.deadline)}</Badge> : null}
                </div>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {account ? (
                <PlacementContractDialog
                  account={account}
                  label="Vertrag"
                  prefill={{
                    type: m.pricing_model === "percent" ? "percent" : "fixed",
                    role: m.role,
                    fee: m.fee,
                    deposit: m.deposit,
                    percent: m.fee_percent,
                    split: m.split_payment,
                  }}
                />
              ) : null}
              <MandateProposalButton
                mandate={m}
                customer={m.account_name}
                contactName={account?.contact_name}
                senderName={account?.owner}
              />
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

      <MandateIntelCard intel={computeMandateIntel(m, list.length)} accountId={account?.id} accountName={account?.name} />

      <Card>
        <CardBody>
          <SectionHeader
            title="Stellenausschreibung"
            hint="Original hinterlegen · anonymisiert teilen"
          />
          <JobPostingCard
            mandateId={m.id}
            role={m.role}
            jobPosting={m.job_posting}
            anonymized={m.job_posting_anonymized}
            shareToken={m.share_token}
          />
        </CardBody>
      </Card>

      <Card>
        <CardBody>
          <SectionHeader
            title="Bewerber-Antworten"
            hint="über den Stellen-Link: Interessiert / Absage"
            action={
              jobResponses.length > 0 ? (
                <Badge tone="brand">{jobResponses.length}</Badge>
              ) : undefined
            }
          />
          {jobResponses.length === 0 ? (
            <p className="text-sm text-muted">
              Noch keine Rückmeldungen. Teile den anonymen Stellen-Link – wer „Interessiert“ oder
              „Nicht interessiert“ klickt, erscheint hier mit Name &amp; E-Mail.
            </p>
          ) : (
            <ul className="space-y-2">
              {jobResponses.map((r) => (
                <li
                  key={r.id}
                  className="flex items-center justify-between gap-3 rounded-xl border border-border bg-elevated/40 px-3 py-2.5"
                >
                  <div className="min-w-0">
                    <Link
                      href={`/cockpit/kandidaten/${r.candidate_id}`}
                      className="truncate text-sm font-medium text-ink hover:text-brand-deep"
                    >
                      {r.candidate_name}
                    </Link>
                    <p className="truncate text-xs text-faint">
                      {r.candidate_email ?? "—"}
                      {r.created_at ? ` · ${formatDate(r.created_at)}` : ""}
                    </p>
                  </div>
                  <Badge tone={r.stage === "interessiert" ? "success" : r.stage === "talent_pool" ? "brand" : "danger"}>
                    {r.stage === "interessiert" ? "Interessiert" : r.stage === "talent_pool" ? "Talent-Pool" : "Absage"}
                  </Badge>
                </li>
              ))}
            </ul>
          )}
        </CardBody>
      </Card>

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

      <Card>
        <CardBody>
          <SectionHeader
            title="Platzierungen"
            hint="Eintritt, 3-Monats-Honorarrate & Garantie"
          />
          <PlacementsCard
            mandateId={m.id}
            accountName={m.account_name}
            role={m.role}
            defaultFee={mandateRevenue(m)}
            candidates={list.map((c) => ({ id: c.id, name: c.name }))}
            placements={placements}
          />
        </CardBody>
      </Card>

      <Card>
        <CardBody>
          <SectionHeader title="Rechnungen" hint="Honorar an den Kunden · Zahlstatus" />
          <InvoicesCard
            mandateId={m.id}
            accountName={m.account_name}
            invoices={invoices}
            placements={placementsToInvoice}
          />
        </CardBody>
      </Card>
    </div>
  );
}
