import { getCandidates } from "@/lib/crm-data";
import { createCandidate } from "@/lib/crm-actions";
import { PageHeader } from "@/components/cockpit/PageHeader";
import { StatCard } from "@/components/cockpit/StatCard";
import { CandidatesView } from "@/components/cockpit/views/CandidatesView";
import { EntityFormDialog, type FormField } from "@/components/cockpit/EntityFormDialog";
import { IconUserCheck } from "@/components/ui/icons";
import { formatNumber } from "@/lib/format";

export const dynamic = "force-dynamic";

const FIELDS: FormField[] = [
  { name: "name", label: "Name", required: true, placeholder: "Vor- und Nachname" },
  { name: "role", label: "Position", placeholder: "z.B. Pflegefachkraft" },
  { name: "mandate_account", label: "Mandat (Account)", full: true },
  {
    name: "stage",
    label: "Phase",
    type: "select",
    options: [
      { value: "neu", label: "Neu" },
      { value: "screening", label: "Screening" },
      { value: "interview", label: "Interview" },
      { value: "angebot", label: "Angebot" },
      { value: "platziert", label: "Platziert" },
    ],
  },
  { name: "source", label: "Quelle", placeholder: "z.B. LinkedIn" },
];

export default async function KandidatenPage() {
  const candidates = await getCandidates();

  const platziert = candidates.filter((c) => c.stage === "platziert").length;
  const aktiv = candidates.filter(
    (c) => c.stage !== "platziert" && c.stage !== "abgelehnt"
  ).length;
  const interviews = candidates.filter((c) => c.stage === "interview").length;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Recruiting"
        title="Kandidaten"
        description="Die Recruiting-Pipeline – von der Ansprache bis zur Platzierung."
        action={
          <EntityFormDialog
            triggerLabel="Kandidat:in anlegen"
            title="Neue:n Kandidat:in anlegen"
            description="Person der Recruiting-Pipeline hinzufügen."
            fields={FIELDS}
            action={createCandidate}
          />
        }
      />

      <div className="grid grid-cols-3 gap-3">
        <StatCard
          label="In Pipeline"
          value={formatNumber(aktiv)}
          hint="aktiv in Bearbeitung"
          accent="sky"
          icon={IconUserCheck}
        />
        <StatCard
          label="In Interviews"
          value={formatNumber(interviews)}
          hint="laufende Gespräche"
          accent="brand"
          icon={IconUserCheck}
        />
        <StatCard
          label="Platziert"
          value={formatNumber(platziert)}
          hint="erfolgreich vermittelt"
          accent="success"
          icon={IconUserCheck}
        />
      </div>

      <CandidatesView candidates={candidates} />
    </div>
  );
}
