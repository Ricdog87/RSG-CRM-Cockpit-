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
  const { account, opportunities, kiProjects, mandates, candidates } = detail;
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

  return (
    <div className="space-y-6">
      <Link
        href="/cockpit/kunden"
        className="inline-flex items-center gap-1 text-sm text-muted hover:text-ink"
      >
        <IconChevronRight size={14} className="rotate-180" /> Zurück zu Kunden
      </Link>

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
            <div className="flex flex-col items-end gap-2">
              <div className="text-right">
                <p className="text-2xl font-bold text-ink">
                  {account.mrr > 0 ? `${formatEur(account.mrr)}/M` : "—"}
                </p>
                <p className="text-xs text-faint">wiederkehrender Umsatz</p>
              </div>
              <div className="flex items-center gap-2">
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
                }}
              />
              </div>
            </div>
          </div>

          <div className="grid gap-3 border-t border-border/60 pt-4 sm:grid-cols-3">
            <div>
              <p className="kpi-label">Ansprechpartner:in</p>
              <p className="mt-1 text-sm text-ink">{account.contact_name || "—"}</p>
            </div>
            <div className="min-w-0">
              <p className="kpi-label">E-Mail</p>
              <Copyable value={account.contact_email} label="E-Mail" className="mt-1 w-full text-sm text-ink" />
            </div>
            <div className="min-w-0">
              <p className="kpi-label">Telefon</p>
              <Copyable value={account.contact_phone} label="Telefon" className="mt-1 w-full text-sm text-ink" />
            </div>
            <div>
              <p className="kpi-label">Adresse</p>
              <p className="mt-1 text-sm text-ink">
                {[account.strasse, [account.plz, account.ort].filter(Boolean).join(" ")]
                  .filter(Boolean)
                  .join(", ") || "—"}
              </p>
            </div>
            <div>
              <p className="kpi-label">Segment</p>
              <p className="mt-1 text-sm text-ink">{account.segment || "—"}</p>
            </div>
            <div>
              <p className="kpi-label">Land/Region</p>
              <p className="mt-1 text-sm text-ink">{account.country || "—"}</p>
            </div>
            <div>
              <p className="kpi-label">Zuständig</p>
              <p className="mt-1 truncate text-sm text-ink">{account.owner || "—"}</p>
            </div>
          </div>
          {account.last_activity_at ? (
            <p className="text-xs text-faint">
              Letzte Aktivität: {formatDate(account.last_activity_at)}
              {account.external_id ? ` · HubSpot-ID ${account.external_id}` : ""}
            </p>
          ) : null}
        </CardBody>
      </Card>

      {/* Account-Intelligenz: Health-Score + nächste beste Aktion */}
      <SafeBoundary label="Intelligenz">
        <AccountIntelCard intel={intel} accountId={account.id} accountName={account.name} />
      </SafeBoundary>

      {/* Schnell protokollieren: Call/E-Mail bei diesem Kunden */}
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

      {/* Ansprechpartner:innen */}
      <SafeBoundary label="Kontakte">
        <AccountContacts accountId={account.id} contacts={contacts} />
      </SafeBoundary>

      <SafeBoundary label="KI-Analyse">
        <div className="grid gap-6 lg:grid-cols-2">
          {/* KI-Analyse des Accounts */}
          <AccountEnrich
            company={account.name}
            domain={account.contact_email ? account.contact_email.split("@")[1] : undefined}
            notes={[account.branche, account.segment, account.ort]
              .filter(Boolean)
              .join(" · ")}
          />
          {/* KI-Follow-up-Entwurf */}
          <FollowupDrafter
            account={account.name}
            line={account.line}
            context={followupContext}
            goal={intel.nextAction}
            recipientEmail={account.contact_email || undefined}
          />
        </div>
      </SafeBoundary>

      {/* B2B-Outbound-Sequenz (Kaltakquise-Kadenz) */}
      <SafeBoundary label="Sequenz">
        <AccountSequenceEnroll accountId={account.id} accountName={account.name} defaultLine={account.line} />
      </SafeBoundary>

      <SafeBoundary label="Aufgaben & Notizen">
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Aufgaben */}
          <AccountTasks accountId={account.id} accountName={account.name} tasks={tasks} />
          {/* Notizen */}
          <AccountNotes accountId={account.id} notes={notes} />
        </div>
      </SafeBoundary>

      {/* Korrespondenz (BCC-getrackte E-Mails) */}
      <SafeBoundary label="Korrespondenz">
        <Card>
          <CardBody>
            <SectionHeader
              title="Korrespondenz"
              hint="per BCC automatisch getrackte E-Mails"
            />
            <EmailTimeline
              activities={emails}
              limit={5}
              emptyText="Noch keine E-Mails. Setze deine BCC-Adresse (Postfach) ins BCC, um Mails automatisch hier zu protokollieren."
            />
          </CardBody>
        </Card>
      </SafeBoundary>

      <SafeBoundary label="Vermittlungsvertrag">
        <Card>
          <CardBody>
            <SectionHeader
              title="Vermittlungsvertrag"
              hint="Mandatsart, Status & Honorarvereinbarung"
              action={<PlacementContractDialog account={account} />}
            />
            <AccountContractCard account={account} />
          </CardBody>
        </Card>
      </SafeBoundary>

      <SafeBoundary label="Verknüpfungen">
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Verkaufschancen */}
        <Card>
          <CardBody>
            <SectionHeader
              title="Verkaufschancen"
              hint={`${opportunities.length} verknüpft`}
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
            <SectionHeader
              title="KI-Projekte"
              hint={`${kiProjects.length} aktiv`}
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

        {/* Mandate */}
        <Card>
          <CardBody>
            <SectionHeader
              title="Recruiting-Mandate"
              hint={`${mandates.length} verknüpft`}
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
      </div>
      </SafeBoundary>
    </div>
  );
}
