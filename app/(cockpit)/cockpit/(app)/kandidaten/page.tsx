import { getCandidates } from "@/lib/crm-data";
import { PageHeader } from "@/components/cockpit/PageHeader";
import { StatCard } from "@/components/cockpit/StatCard";
import { KanbanBoard, type BoardColumn } from "@/components/cockpit/KanbanBoard";
import { Button } from "@/components/ui/Button";
import { IconUserCheck, IconPlus } from "@/components/ui/icons";
import { formatDate, formatNumber } from "@/lib/format";
import type { Candidate, CandidateStage } from "@/lib/crm-types";

export const dynamic = "force-dynamic";

const COLUMNS: BoardColumn<CandidateStage>[] = [
  { stage: "neu", label: "Neu", tone: "neutral" },
  { stage: "screening", label: "Screening", tone: "sky" },
  { stage: "interview", label: "Interview", tone: "brand" },
  { stage: "angebot", label: "Angebot", tone: "brand" },
  { stage: "platziert", label: "Platziert", tone: "success" },
];

function CandidateCard({ c }: { c: Candidate }) {
  return (
    <div className="rounded-xl border border-border bg-elevated/50 p-3 transition-colors hover:border-brand/40">
      <p className="truncate text-sm font-medium text-ink">{c.name}</p>
      <p className="truncate text-xs text-muted">{c.role}</p>
      <p className="mt-2 truncate text-xs text-faint">{c.mandate_account}</p>
      <div className="mt-2 flex items-center justify-between text-[0.7rem] text-faint">
        <span>{c.source}</span>
        <span>{formatDate(c.updated_at)}</span>
      </div>
    </div>
  );
}

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
          <Button>
            <IconPlus size={16} /> Kandidat:in anlegen
          </Button>
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

      <KanbanBoard
        columns={COLUMNS}
        items={candidates.filter((c) => c.stage !== "abgelehnt")}
        getStage={(c) => c.stage}
        renderCard={(c) => <CandidateCard c={c} />}
        emptyText="Noch keine Kandidat:innen. Lege deine erste Person an oder importiere aus dem Sourcing."
      />
    </div>
  );
}
