import Link from "next/link";
import { notFound } from "next/navigation";
import { getAccountDetail } from "@/lib/crm-data";
import { getEmailActivitiesForAccount } from "@/lib/email-data";
import { getNotesForAccount } from "@/lib/notes-data";
import { getTasksForRelated } from "@/lib/tasks-data";
import { getContactsForAccount } from "@/lib/contacts-data";
import { EmailTimeline } from "@/components/cockpit/EmailTimeline";
import { AccountNotes } from "@/components/cockpit/AccountNotes";
import { AccountTasks } from "@/components/cockpit/AccountTasks";
import { AccountContacts } from "@/components/cockpit/AccountContacts";
import { Card, CardBody, SectionHeader } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { LineBadge } from "@/components/cockpit/LineBadge";
import { EmptyState } from "@/components/ui/EmptyState";
import { IconChevronRight } from "@/components/ui/icons";
import { AccountEnrich } from "@/components/cockpit/AccountEnrich";
import { WebsiteEnrich } from "@/components/cockpit/WebsiteEnrich";
import { AccountContractCard } from "@/components/cockpit/AccountContractCard";
import { PlacementContractDialog } from "@/components/cockpit/PlacementContractDialog";
import { EditDialog } from "@/components/cockpit/EditDialog";
import { EmailComposer } from "@/components/cockpit/EmailComposer";
import { ActivityLogger } from "@/components/cockpit/ActivityLogger";
import { ACCOUNT_FIELDS, OPPORTUNITY_FIELDS, KIPROJECT_FIELDS } from "@/lib/crm-forms";
import { updateAccount, createOpportunity, createKiProject } from "@/lib/crm-actions";
import { EntityFormDialog } from "@/components/cockpit/EntityFormDialog";
import { MandateFormDialog } from "@/components/cockpit/MandateFormDialog";
import { getPartnerIdentity } from "@/lib/data";
import { AccountIntelCard } from "@/components/cockpit/AccountIntelCard";
import { FollowupDrafter } from "@/components/cockpit/FollowupDrafter";
import { AccountSequenceEnroll } from "@/components/cockpit/AccountSequenceEnroll";
import { RelationshipSummary } from "@/components/cockpit/RelationshipSummary";
import { computeAccountIntel } from "@/lib/account-intel";
import { BackfillAccountsButton } from "@/components/cockpit/BackfillAccountsButton";
import { SafeBoundary } from "@/components/cockpit/SafeBoundary";
import { Copyable } from "@/components/ui/Copyable";
import { formatDate, formatEur, formatPercent } from "@/lib/format";

export const dynamic = "force-dynamic";

const lifecycleLabel: Record<string, string> = {
  lead: "Lead",
  opportunity: "Opportunity",
  kunde: "Kunde",
  bestand: "Bestand",
};

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
}

/** Label/Wert-Zeile im „Wichtige Infos"-Block (HubSpot-Stil). */
function InfoItem({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="py-2 first:pt-0 last:pb-0">
      <p className="kpi-label">{label}</p>
      <div className="mt-0.5 text-sm text-ink">{children}</div>
    </div>
  );
}

function Row({
  title,
  subtitle,
  right,
  badge,
  href,
}: {
  title: string;
  subtitle?: string;
  right?: string;
  badge?: React.ReactNode;
  href?: string;
}) {
  const body = (
    <div className="min-w-0">
      <p className="truncate text-sm font-medium text-ink group-hover:text-brand-deep">{title}</p>
      {subtitle ? <p className="truncate text-xs text-muted">{subtitle}</p> : null}
    </div>
  );
  return (
    <li className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
      {href ? (
        <Link href={href} className="group min-w-0 flex-1">
          {body}
        </Link>
      ) : (
        body
      )}
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
  const { account, parent, children, opportunities, kiProjects, mandates, candidates } = detail;
  const [emails, notes, tasks, contacts, identity] = await Promise.all([
    getEmailActivitiesForAccount(account.id, account.name),
    getNotesForAccount(account.id),
    getTasksForRelated("customer", account.id),
    getContactsForAccount(account.id),
    getPartnerIdentity(),
  ]);

  const intel = computeAccountIntel({
    account,
    opportunities,
    kiProjects,
    mandates,
    candidates,
    activityDates: [
      ...emails.map((e) => e.occurred_at),
      ...notes.map((n) => n.created_at),
      ...tasks.map((t) => t.due_date),
    ],
  });

  // Kompakter Kontext für den KI-Follow-up-Entwurf.
  const followupContext = [
    `Branche/Segment: ${[account.branche, account.segment].filter(Boolean).join(" · ") || "—"}`,
    `Status: ${account.lifecycle}`,
    mandates.length ? `Mandate: ${mandates.map((m) => `${m.role} (${m.status})`).join(", ")}` : "",
    kiProjects.length ? `KI-Projekte: ${kiProjects.map((p) => `${p.product || "KI"} (${p.status})`).join(", ")}` : "",
    notes[0]?.body ? `Letzte Notiz: ${notes[0].body.slice(0, 240)}` : "",
    `Empfehlung (Health-Score ${intel.score}): ${intel.nextAction}`,
  ]
    .filter(Boolean)
    .join("\n");

  const address =
    [account.strasse, [account.plz, account.ort].filter(Boolean).join(" ")]
      .filter(Boolean)
      .join(", ") || "—";

  return (
    <div className="space-y-4">
      <nav className="flex items-center gap-1.5 text-sm text-muted">
        <Link href="/cockpit/kunden" className="hover:text-ink">
          Kunden
        </Link>
        <IconChevronRight size={14} className="text-faint" />
        <span className="truncate text-ink">{account.name}</span>
      </nav>

      {account.synthetic ? (
        <Card>
          <CardBody className="space-y-2">
            <p className="text-sm font-semibold text-ink">Abgeleiteter Kunde</p>
            <p className="text-xs text-muted">
              Dieser Kunde wurde aus referenzierenden Mandaten/Projekten erkannt, ist aber noch
              kein eigener Datensatz. Lege ihn an, um Notizen, Aufgaben und Kontakte zu speichern.
            </p>
            <BackfillAccountsButton derivedCount={1} />
          </CardBody>
        </Card>
      ) : null}

      {/* HubSpot-Style 3-Spalten-Record: Identität · Aktivitäten · Verknüpfungen */}
      <div className="grid gap-4 xl:grid-cols-[minmax(0,20rem)_minmax(0,1fr)_minmax(0,21rem)] xl:items-start">
        {/* ─────────── LINKS: Identität & Stammdaten ─────────── */}
        <div className="space-y-4 xl:sticky xl:top-20">
          <Card>
            <CardBody className="space-y-4">
              <div className="flex items-start gap-3">
                <span className="flex h-12 w-12 flex-none items-center justify-center rounded-2xl bg-gradient-to-br from-brand to-sky text-sm font-black text-white">
                  {initials(account.name) || "?"}
                </span>
                <div className="min-w-0">
                  <h1 className="truncate text-lg font-bold text-ink">{account.name}</h1>
                  <p className="truncate text-xs text-muted">
                    {[account.branche, account.ort].filter(Boolean).join(" · ") || account.line}
                  </p>
                  <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                    <LineBadge line={account.line} />
                    <Badge tone="sky">{lifecycleLabel[account.lifecycle] ?? account.lifecycle}</Badge>
                  </div>
                </div>
              </div>

              {/* Schnellaktionen */}
              <div className="flex flex-wrap items-center gap-2 border-t border-border/60 pt-3">
                <SafeBoundary label="Aktionen">
                  <EmailComposer account={account} contacts={contacts} senderName={identity.display_name} />
                </SafeBoundary>
                <EditDialog
                  id={account.id}
                  title="Kunde bearbeiten"
                  description="Stammdaten, Adresse & Kontakt – Basis für Vertrag/Angebot."
                  fields={ACCOUNT_FIELDS}
                  action={updateAccount}
                  initial={{
                    name: account.name,
                    line: account.line,
                    lifecycle: account.lifecycle,
                    branche: account.branche,
                    segment: account.segment,
                    strasse: account.strasse ?? "",
                    plz: account.plz ?? "",
                    ort: account.ort,
                    country: account.country ?? "",
                    contact_name: account.contact_name,
                    contact_email: account.contact_email,
                    contact_phone: account.contact_phone ?? "",
                    owner: account.owner ?? "",
                    mrr: String(account.mrr ?? ""),
                    domain: account.domain ?? "",
                  }}
                />
              </div>

              {account.mrr > 0 ? (
                <div className="rounded-xl border border-border bg-elevated/40 px-3 py-2">
                  <p className="kpi-label">Wiederkehrender Umsatz</p>
                  <p className="text-xl font-bold text-ink">{formatEur(account.mrr)}/M</p>
                </div>
              ) : null}
            </CardBody>
          </Card>

          {/* Wichtige Informationen */}
          <Card>
            <CardBody>
              <SectionHeader title="Wichtige Informationen" />
              <div className="divide-y divide-border/60">
                <InfoItem label="Zuständig">{account.owner || "—"}</InfoItem>
                <InfoItem label="Lifecycle-Phase">
                  {lifecycleLabel[account.lifecycle] ?? account.lifecycle}
                </InfoItem>
                <InfoItem label="Ansprechpartner:in">{account.contact_name || "—"}</InfoItem>
                <InfoItem label="E-Mail">
                  <Copyable value={account.contact_email} label="E-Mail" className="w-full" />
                </InfoItem>
                <InfoItem label="Telefon">
                  <Copyable value={account.contact_phone} label="Telefon" className="w-full" />
                </InfoItem>
                <InfoItem label="Adresse">{address}</InfoItem>
                <InfoItem label="Segment">{account.segment || "—"}</InfoItem>
                <InfoItem label="Land/Region">{account.country || "—"}</InfoItem>
                <InfoItem label="Letzte Kontaktaufnahme">
                  {account.last_activity_at ? formatDate(account.last_activity_at) : "—"}
                  {account.external_id ? (
                    <span className="text-xs text-faint"> · HubSpot-ID {account.external_id}</span>
                  ) : null}
                </InfoItem>
              </div>
            </CardBody>
          </Card>

          {/* Konzernstruktur */}
          {parent || children.length > 0 ? (
            <Card>
              <CardBody className="space-y-2">
                <SectionHeader title="Konzernstruktur" />
                {parent ? (
                  <div>
                    <p className="kpi-label">Gehört zu</p>
                    <Link
                      href={`/cockpit/kunden/${parent.id}`}
                      className="text-sm font-medium text-brand-deep hover:underline"
                    >
                      {parent.name}
                    </Link>
                  </div>
                ) : null}
                {children.length > 0 ? (
                  <div>
                    <p className="kpi-label">
                      {children.length === 1 ? "1 Tochter" : `${children.length} Töchter`}
                    </p>
                    <div className="mt-1 flex flex-wrap gap-1.5">
                      {children.map((c) => (
                        <Link
                          key={c.id}
                          href={`/cockpit/kunden/${c.id}`}
                          className="rounded-full bg-elevated px-2 py-0.5 text-xs font-medium text-ink hover:text-brand-deep"
                        >
                          {c.name}
                        </Link>
                      ))}
                    </div>
                  </div>
                ) : null}
              </CardBody>
            </Card>
          ) : null}

          {/* Ansprechpartner:innen */}
          <SafeBoundary label="Kontakte">
            <AccountContacts accountId={account.id} contacts={contacts} />
          </SafeBoundary>
        </div>

        {/* ─────────── MITTE: Aktivitäten ─────────── */}
        <div className="space-y-4">
          <SafeBoundary label="Intelligenz">
            <AccountIntelCard intel={intel} accountId={account.id} accountName={account.name} />
          </SafeBoundary>

          {/* Website: öffentliches Firmenprofil laden (Claude liest die Seite) */}
          <SafeBoundary label="Website">
            <WebsiteEnrich accountId={account.id} domain={account.domain} />
          </SafeBoundary>

          <Card>
            <CardBody>
              <ActivityLogger accounts={[account.name]} defaultAccount={account.name} lineLock={account.line} />
            </CardBody>
          </Card>

          {notes.length > 0 || emails.length > 0 ? (
            <SafeBoundary label="Beziehung">
              <RelationshipSummary
                account={account.name}
                line={account.line}
                touchpoints={[
                  ...notes.slice(0, 8).map((n) => ({ kind: "note" as const, date: n.created_at, text: n.body })),
                  ...emails.slice(0, 8).map((e) => ({
                    kind: "email" as const,
                    date: e.occurred_at,
                    direction: e.direction,
                    text: `${e.subject}${e.snippet ? ` – ${e.snippet}` : ""}`,
                  })),
                ]
                  .sort((a, b) => (b.date ?? "").localeCompare(a.date ?? ""))
                  .slice(0, 12)}
              />
            </SafeBoundary>
          ) : null}

          <SafeBoundary label="Aufgaben & Notizen">
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-1">
              <AccountTasks accountId={account.id} accountName={account.name} tasks={tasks} />
              <AccountNotes accountId={account.id} notes={notes} />
            </div>
          </SafeBoundary>

          <SafeBoundary label="Korrespondenz">
            <Card>
              <CardBody>
                <SectionHeader title="Korrespondenz" hint="per BCC automatisch getrackte E-Mails" />
                <EmailTimeline
                  activities={emails}
                  limit={5}
                  emptyText="Noch keine E-Mails. Setze deine BCC-Adresse (Postfach) ins BCC, um Mails automatisch hier zu protokollieren."
                />
              </CardBody>
            </Card>
          </SafeBoundary>

          <SafeBoundary label="KI-Analyse">
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-1">
              <AccountEnrich
                company={account.name}
                domain={account.contact_email ? account.contact_email.split("@")[1] : undefined}
                notes={[account.branche, account.segment, account.ort].filter(Boolean).join(" · ")}
              />
              <FollowupDrafter
                account={account.name}
                line={account.line}
                context={followupContext}
                goal={intel.nextAction}
                recipientEmail={account.contact_email || undefined}
              />
            </div>
          </SafeBoundary>

          <SafeBoundary label="Sequenz">
            <AccountSequenceEnroll accountId={account.id} accountName={account.name} defaultLine={account.line} />
          </SafeBoundary>
        </div>

        {/* ─────────── RECHTS: Verknüpfungen (Deals & Projekte) ─────────── */}
        <SafeBoundary label="Verknüpfungen">
          <div className="space-y-4">
            {/* Verkaufschancen = „Deals" */}
            <Card>
              <CardBody>
                <SectionHeader
                  title={`Verkaufschancen (${opportunities.length})`}
                  action={
                    <EntityFormDialog
                      triggerLabel="+ Chance"
                      title="Neue Verkaufschance"
                      description={`Für ${account.name}`}
                      fields={OPPORTUNITY_FIELDS}
                      action={createOpportunity}
                      initial={{ account_name: account.name, line: account.line }}
                    />
                  }
                />
                {opportunities.length === 0 ? (
                  <EmptyState title="Keine offenen Chancen für diesen Account." />
                ) : (
                  <ul className="divide-y divide-border">
                    {opportunities.map((o) => (
                      <Row
                        key={o.id}
                        title={o.title || o.account_name}
                        subtitle={`${o.owner} · ${formatDate(o.expected_close)}`}
                        right={o.value_type === "mrr" ? `${formatEur(o.value)}/M` : formatEur(o.value)}
                        badge={<Badge tone="brand">{formatPercent(o.probability)}</Badge>}
                      />
                    ))}
                  </ul>
                )}
              </CardBody>
            </Card>

            {/* Recruiting-Mandate */}
            <Card>
              <CardBody>
                <SectionHeader
                  title={`Recruiting-Mandate (${mandates.length})`}
                  action={<MandateFormDialog defaultAccountName={account.name} compact />}
                />
                {mandates.length === 0 ? (
                  <EmptyState title="Kein Mandat für diesen Account." />
                ) : (
                  <ul className="divide-y divide-border">
                    {mandates.map((m) => (
                      <Row
                        key={m.id}
                        href={`/cockpit/projekte/recruiting/${m.id}`}
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

            {/* KI-Projekte */}
            <Card>
              <CardBody>
                <SectionHeader
                  title={`KI-Projekte (${kiProjects.length})`}
                  action={
                    <EntityFormDialog
                      triggerLabel="+ KI-Projekt"
                      title="Neues KI-Projekt"
                      description={`Für ${account.name}`}
                      fields={KIPROJECT_FIELDS}
                      action={createKiProject}
                      initial={{ account_name: account.name }}
                    />
                  }
                />
                {kiProjects.length === 0 ? (
                  <EmptyState title="Kein KI-Projekt für diesen Account." />
                ) : (
                  <ul className="divide-y divide-border">
                    {kiProjects.map((p) => (
                      <Row
                        key={p.id}
                        href={`/cockpit/projekte/ki/${p.id}`}
                        title={p.product || "KI-Projekt"}
                        subtitle={
                          p.setup_fee
                            ? `Go-Live ${formatDate(p.go_live)} · ${formatEur(p.setup_fee)} Setup`
                            : `Go-Live ${formatDate(p.go_live)}`
                        }
                        right={`${formatEur(p.mrr)}/M`}
                        badge={<Badge tone="sky">{p.status}</Badge>}
                      />
                    ))}
                  </ul>
                )}
              </CardBody>
            </Card>

            {/* Kandidaten */}
            <Card>
              <CardBody>
                <SectionHeader title={`Kandidaten (${candidates.length})`} />
                {candidates.length === 0 ? (
                  <EmptyState title="Keine Kandidat:innen für diesen Account." />
                ) : (
                  <ul className="divide-y divide-border">
                    {candidates.map((c) => (
                      <Row
                        key={c.id}
                        href={`/cockpit/kandidaten/${c.id}`}
                        title={c.name}
                        subtitle={c.role}
                        badge={<Badge tone="sky">{c.stage}</Badge>}
                      />
                    ))}
                  </ul>
                )}
              </CardBody>
            </Card>

            {/* Vermittlungsvertrag */}
            <Card>
              <CardBody>
                <SectionHeader
                  title="Vermittlungsvertrag"
                  hint="Mandatsart, Status & Honorar"
                  action={<PlacementContractDialog account={account} label="Erstellen" />}
                />
                <AccountContractCard account={account} />
              </CardBody>
            </Card>
          </div>
        </SafeBoundary>
      </div>
    </div>
  );
}
