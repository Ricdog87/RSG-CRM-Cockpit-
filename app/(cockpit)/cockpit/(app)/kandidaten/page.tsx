import { getCandidates, getAccounts, getMandates } from "@/lib/crm-data";
import { createCandidate } from "@/lib/crm-actions";
import { PageHeader } from "@/components/cockpit/PageHeader";
import { StatCard } from "@/components/cockpit/StatCard";
import { CandidatesView } from "@/components/cockpit/views/CandidatesView";
import { EntityFormDialog } from "@/components/cockpit/EntityFormDialog";
import { CvUploadDialog } from "@/components/cockpit/CvUploadDialog";
import { CvAnalyzerDialog } from "@/components/cockpit/CvAnalyzerDialog";
import { CandidateDuplicates } from "@/components/cockpit/CandidateDuplicates";
import { findCandidateDuplicates } from "@/lib/candidate-dedupe";
import { CANDIDATE_FIELDS, withDatalist, withSelectOptions } from "@/lib/crm-forms";
import { IconUsers, IconCalendar, IconTrophy } from "@/components/ui/icons";
import { formatNumber } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function KandidatenPage() {
  const [candidates, accounts, mandates] = await Promise.all([
    getCandidates(),
    getAccounts(),
    getMandates(),
  ]);
  const accountNames = accounts.map((a) => a.name);
  const mandateOptions = mandates.map((m) => ({
    value: m.id,
    label: `${m.account_name} · ${m.role || "Mandat"}`,
  }));
  const createFields = withSelectOptions(
    withDatalist(CANDIDATE_FIELDS, "mandate_account", accountNames),
    "mandate_id",
    [{ value: "", label: "— kein Mandat —" }, ...mandateOptions]
  );

  const platziert = candidates.filter((c) => c.stage === "platziert").length;
  const aktiv = candidates.filter(
    (c) => c.stage !== "platziert" && c.stage !== "abgelehnt"
  ).length;
  const interviews = candidates.filter((c) => c.stage === "interview").length;
  const duplicateGroups = findCandidateDuplicates(candidates);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Recruiting"
        title="Kandidaten"
        description="Die Recruiting-Pipeline – von der Ansprache bis zur Platzierung."
        action={
          <div className="flex flex-wrap items-center gap-2">
            <CvAnalyzerDialog />
            <CvUploadDialog />
            <EntityFormDialog
              triggerLabel="Kandidat:in anlegen"
              title="Neue:n Kandidat:in anlegen"
              description="Person der Recruiting-Pipeline hinzufügen."
              fields={createFields}
              action={createCandidate}
              autoOpenParam="new"
            />
          </div>
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        <StatCard
          label="In Pipeline"
          value={formatNumber(aktiv)}
          hint="aktiv in Bearbeitung"
          accent="sky"
          icon={IconUsers}
        />
        <StatCard
          label="In Interviews"
          value={formatNumber(interviews)}
          hint="laufende Gespräche"
          accent="brand"
          icon={IconCalendar}
        />
        <StatCard
          label="Platziert"
          value={formatNumber(platziert)}
          hint="erfolgreich vermittelt"
          accent="success"
          icon={IconTrophy}
        />
      </div>

      <CandidateDuplicates groups={duplicateGroups} />

      <CandidatesView
        candidates={candidates}
        accountNames={accountNames}
        mandateOptions={mandateOptions}
      />
    </div>
  );
}
