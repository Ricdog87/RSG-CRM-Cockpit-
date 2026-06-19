import Link from "next/link";
import { notFound } from "next/navigation";
import { getKiProject, getAccounts, accountKey } from "@/lib/crm-data";
import { getTasksForRelated } from "@/lib/tasks-data";
import { getMilestonesForProject, getReadinessForProject } from "@/lib/ki-plan-data";
import { getMetricsForProject } from "@/lib/ki-metrics-data";
import { updateKiProject } from "@/lib/crm-actions";
import { KIPROJECT_FIELDS, withCombobox } from "@/lib/crm-forms";
import { Card, CardBody, SectionHeader } from "@/components/ui/Card";
import { StatCard } from "@/components/cockpit/StatCard";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { SafeBoundary } from "@/components/cockpit/SafeBoundary";
import { EditDialog } from "@/components/cockpit/EditDialog";
import { KiProjectControls } from "@/components/cockpit/KiProjectControls";
import { MilestonesCard, ReadinessChecklist } from "@/components/cockpit/KiProjectPlan";
import { KiMetricsCard } from "@/components/cockpit/KiMetricsCard";
import { KiContractCard } from "@/components/cockpit/KiContractCard";
import { KiProjectIntelCard } from "@/components/cockpit/KiProjectIntelCard";
import { KiProposalButton } from "@/components/cockpit/KiProposalButton";
import { computeKiProjectIntel } from "@/lib/ki-intel";
import {
  IconChevronRight,
  IconPhone,
  IconEuro,
  IconBolt,
  IconBriefcase,
  IconCheck,
} from "@/components/ui/icons";
import { formatDate, formatEur } from "@/lib/format";
import type { Health, KiStatus } from "@/lib/crm-types";

export const dynamic = "force-dynamic";

const statusMeta: Record<KiStatus, { label: string; tone: "neutral" | "sky" | "success" | "brand" | "warning" | "danger" }> = {
  angebot: { label: "Angebot / Planung", tone: "neutral" },
  onboarding: { label: "Onboarding", tone: "sky" },
  live: { label: "Live", tone: "success" },
  optimierung: { label: "Optimierung", tone: "brand" },
  pausiert: { label: "Pausiert", tone: "warning" },
  gekuendigt: { label: "Gekündigt", tone: "danger" },
};
const healthMeta: Record<Health, { label: string; tone: "success" | "neutral" | "danger" }> = {
  gut: { label: "Gesund", tone: "success" },
  neutral: { label: "Stabil", tone: "neutral" },
  risiko: { label: "Risiko", tone: "danger" },
};

/** Label/Wert-Zeile im „Stammdaten"-Block (HubSpot-Stil). */
function InfoItem({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="py-2 first:pt-0 last:pb-0">
      <p className="kpi-label">{label}</p>
      <div className="mt-0.5 text-sm text-ink">{children || "—"}</div>
    </div>
  );
}

export default async function KiProjectDetailPage({ params }: { params: { id: string } }) {
  const [p, accounts, tasks, milestones, readiness, metrics] = await Promise.all([
    getKiProject(params.id),
    getAccounts(),
    getTasksForRelated("project", params.id),
    getMilestonesForProject(params.id),
    getReadinessForProject(params.id),
    getMetricsForProject(params.id),
  ]);
  if (!p) notFound();

  const account = accounts.find((a) => accountKey(a.name) === accountKey(p.account_name));
  const st = statusMeta[p.status] ?? statusMeta.onboarding;
  const he = healthMeta[p.health] ?? healthMeta.neutral;
  const arr = p.mrr * 12;
  const editFields = withCombobox(KIPROJECT_FIELDS, "account_name", accounts.map((a) => a.name));
  const openTasks = tasks.filter((t) => !t.done);

  return (
    <div className="space-y-4">
      <nav className="flex items-center gap-1.5 text-sm text-muted">
        <Link href="/cockpit/projekte/ki" className="hover:text-ink">KI &amp; Telefonassistenz</Link>
        <IconChevronRight size={14} className="text-faint" />
        <span className="truncate text-ink">{p.product || p.account_name}</span>
      </nav>

      {/* HubSpot-Style 3-Spalten-Record: Identität · Betrieb · Vertrag */}
      <div className="grid gap-4 xl:grid-cols-[minmax(0,20rem)_minmax(0,1fr)_minmax(0,21rem)] xl:items-start">
        {/* ─────────── LINKS: Identität & Stammdaten ─────────── */}
        <div className="space-y-4 xl:sticky xl:top-20">
          <Card>
            <CardBody className="space-y-4">
              <div className="flex items-start gap-3">
                <span className="flex h-12 w-12 flex-none items-center justify-center rounded-2xl bg-gradient-to-br from-brand to-sky text-white">
                  <IconPhone size={22} />
                </span>
                <div className="min-w-0">
                  <h1 className="truncate text-lg font-bold text-ink">{p.product || "KI-Projekt"}</h1>
                  {account ? (
                    <Link href={`/cockpit/kunden/${account.id}`} className="block truncate text-xs text-muted hover:text-brand-deep">
                      {p.account_name}
                    </Link>
                  ) : (
                    <p className="truncate text-xs text-muted">{p.account_name}</p>
                  )}
                  <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                    <Badge tone={st.tone}>{st.label}</Badge>
                    <Badge tone={he.tone}>{he.label}</Badge>
                    {p.go_live ? <Badge tone="neutral">Go-Live {formatDate(p.go_live)}</Badge> : null}
                  </div>
                </div>
              </div>

              {/* Schnellaktionen */}
              <div className="flex flex-wrap items-center gap-2 border-t border-border/60 pt-3">
                <EditDialog
                  id={p.id}
                  title="KI-Projekt bearbeiten"
                  fields={editFields}
                  action={updateKiProject}
                  initial={{
                    account_name: p.account_name,
                    product: p.product,
                    segment: p.segment,
                    status: p.status,
                    health: p.health,
                    setup_fee: p.setup_fee ? String(p.setup_fee) : "",
                    mrr: String(p.mrr ?? ""),
                    go_live: p.go_live,
                    use_case: p.use_case ?? "",
                    project_manager: p.project_manager ?? "",
                    kickoff_date: p.kickoff_date ?? "",
                    decision_maker: p.decision_maker ?? "",
                    tech_contact: p.tech_contact ?? "",
                  }}
                />
                <KiProposalButton project={p} customer={p.account_name} contactName={account?.contact_name} />
              </div>
              <KiProjectControls id={p.id} status={p.status} health={p.health} />
            </CardBody>
          </Card>

          {/* Use-Case & Stammdaten */}
          <Card>
            <CardBody>
              <SectionHeader title="Use-Case & Stammdaten" hint="Was die KI automatisiert" />
              {p.use_case ? (
                <p className="mb-3 whitespace-pre-line rounded-xl border border-border bg-elevated/40 px-3 py-2.5 text-sm text-ink">{p.use_case}</p>
              ) : (
                <p className="mb-3 text-sm text-muted">Noch kein Use-Case hinterlegt – per „Bearbeiten“ ergänzen.</p>
              )}
              <div className="divide-y divide-border/60">
                <InfoItem label="Produkt">{p.product}</InfoItem>
                <InfoItem label="Segment">{p.segment}</InfoItem>
                <InfoItem label="Projektverantwortlich (intern)">{p.project_manager}</InfoItem>
                <InfoItem label="Kickoff">{p.kickoff_date ? formatDate(p.kickoff_date) : ""}</InfoItem>
                <InfoItem label="Entscheider (Kunde)">{p.decision_maker}</InfoItem>
                <InfoItem label="Technischer Ansprechpartner">{p.tech_contact}</InfoItem>
              </div>
            </CardBody>
          </Card>

          {/* Verknüpfter Kunde */}
          {account ? (
            <Card>
              <CardBody>
                <SectionHeader title="Kunde" hint="verknüpftes Unternehmen" />
                <Link href={`/cockpit/kunden/${account.id}`} className="group flex items-center justify-between gap-3 rounded-xl border border-border bg-elevated/40 px-3 py-2.5 hover:border-brand/40">
                  <span className="flex min-w-0 items-center gap-2.5">
                    <span className="flex h-9 w-9 flex-none items-center justify-center rounded-lg bg-sky/10 text-sky-deep"><IconBriefcase size={16} /></span>
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium text-ink group-hover:text-brand-deep">{account.name}</span>
                      <span className="block truncate text-xs text-faint">{account.branche || "Account öffnen"}</span>
                    </span>
                  </span>
                  <IconChevronRight size={16} className="flex-none text-faint" />
                </Link>
              </CardBody>
            </Card>
          ) : null}
        </div>

        {/* ─────────── MITTE: Betrieb & Performance ─────────── */}
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <StatCard label="MRR" value={`${formatEur(p.mrr)}/M`} hint="monatlicher Fixpreis" accent="brand" icon={IconEuro} />
            <StatCard label="ARR" value={formatEur(arr)} hint="Jahresumsatz (MRR×12)" accent="success" icon={IconEuro} />
            <StatCard label="Implementierung" value={formatEur(p.setup_fee ?? 0)} hint="einmalig" accent="sky" icon={IconBolt} />
            <StatCard label="Health" value={he.label} hint="Projektgesundheit" accent={p.health === "risiko" ? "warning" : "success"} icon={IconCheck} />
          </div>

          <SafeBoundary label="Intelligenz">
            <KiProjectIntelCard intel={computeKiProjectIntel(p)} accountId={account?.id} accountName={account?.name} />
          </SafeBoundary>

          <SafeBoundary label="Projektplan">
            <Card>
              <CardBody>
                <SectionHeader title="Projektplan" hint="Meilensteine bis Go-Live & Betrieb" />
                <MilestonesCard projectId={p.id} milestones={milestones} />
              </CardBody>
            </Card>
          </SafeBoundary>

          <SafeBoundary label="Betrieb & Performance">
            <Card>
              <CardBody>
                <SectionHeader title="Betrieb & Performance" hint="monatliche Kennzahlen · objektive Health" />
                <KiMetricsCard projectId={p.id} metrics={metrics} />
              </CardBody>
            </Card>
          </SafeBoundary>
        </div>

        {/* ─────────── RECHTS: Readiness, Vertrag & Aufgaben ─────────── */}
        <SafeBoundary label="Vertrag & Aufgaben">
          <div className="space-y-4">
            <Card className="border-brand/30 bg-gradient-to-br from-brand/[0.05] to-sky/[0.04]">
              <CardBody>
                <SectionHeader title="Go-Live-Readiness" hint="Abnahme-Checkliste" />
                <ReadinessChecklist projectId={p.id} state={readiness} />
              </CardBody>
            </Card>

            <Card>
              <CardBody>
                <SectionHeader title="Vertrag & Renewal" hint="Laufzeit · Churn · Upsell" />
                <KiContractCard project={p} />
              </CardBody>
            </Card>

            <Card>
              <CardBody>
                <SectionHeader title="Offene Aufgaben" hint={`${openTasks.length} offen`} />
                {openTasks.length === 0 ? (
                  <EmptyState title="Keine offenen Aufgaben zu diesem Projekt." />
                ) : (
                  <ul className="space-y-2">
                    {openTasks.slice(0, 6).map((t) => (
                      <li key={t.id} className="rounded-lg border border-border bg-elevated/40 px-3 py-2">
                        <p className="truncate text-sm text-ink">{t.title}</p>
                        {t.due_date ? <p className="text-[0.7rem] text-faint">{formatDate(t.due_date)}{t.due_time ? ` · ${t.due_time}` : ""}</p> : null}
                      </li>
                    ))}
                  </ul>
                )}
              </CardBody>
            </Card>
          </div>
        </SafeBoundary>
      </div>
    </div>
  );
}
