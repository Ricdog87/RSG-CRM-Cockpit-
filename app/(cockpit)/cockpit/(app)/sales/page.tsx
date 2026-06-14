import { getOpportunities } from "@/lib/crm-data";
import { PageHeader } from "@/components/cockpit/PageHeader";
import { StatCard } from "@/components/cockpit/StatCard";
import { KanbanBoard, type BoardColumn } from "@/components/cockpit/KanbanBoard";
import { LineBadge } from "@/components/cockpit/LineBadge";
import { Button } from "@/components/ui/Button";
import { IconPlus, IconTarget, IconEuro, IconTrendingUp } from "@/components/ui/icons";
import { formatDate, formatEur, formatPercent } from "@/lib/format";
import type { Opportunity, SalesStage } from "@/lib/crm-types";

export const dynamic = "force-dynamic";

const COLUMNS: BoardColumn<SalesStage>[] = [
  { stage: "neu", label: "Neu", tone: "neutral" },
  { stage: "qualifiziert", label: "Qualifiziert", tone: "cyan" },
  { stage: "demo", label: "Demo/Termin", tone: "cyan" },
  { stage: "angebot", label: "Angebot", tone: "purple" },
  { stage: "verhandlung", label: "Verhandlung", tone: "purple" },
  { stage: "gewonnen", label: "Gewonnen", tone: "success" },
];

function value(o: Opportunity) {
  return o.value_type === "mrr" ? `${formatEur(o.value)}/M` : formatEur(o.value);
}

function OppCard({ o }: { o: Opportunity }) {
  return (
    <div className="rounded-xl border border-border bg-elevated/50 p-3 transition-colors hover:border-purple/40">
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <p className="truncate text-sm font-medium text-ink">{o.account_name}</p>
        <LineBadge line={o.line} />
      </div>
      <p className="truncate text-xs text-muted">{o.title}</p>
      <div className="mt-3 flex items-center justify-between">
        <span className="text-sm font-semibold text-ink">{value(o)}</span>
        <span className="text-xs text-faint">{formatPercent(o.probability)}</span>
      </div>
      <p className="mt-1 text-[0.7rem] text-faint">
        {o.owner} · {formatDate(o.expected_close)}
      </p>
    </div>
  );
}

export default async function SalesPage() {
  const opps = await getOpportunities();
  const open = opps.filter((o) => o.stage !== "gewonnen" && o.stage !== "verloren");

  const weighted = open.reduce((s, o) => s + (o.value * o.probability) / 100, 0);
  const kiOpen = open.filter((o) => o.line === "ki").length;
  const recOpen = open.filter((o) => o.line === "recruiting").length;
  const recVolume = open
    .filter((o) => o.line === "recruiting")
    .reduce((s, o) => s + o.value, 0);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Vertrieb"
        title="Sales-Pipeline"
        description="Projekt-Verkaufschancen über beide Geschäftslinien – KI und Personalvermittlung."
        action={
          <Button>
            <IconPlus size={16} /> Chance anlegen
          </Button>
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          label="Offene Chancen"
          value={`${open.length}`}
          hint={`${kiOpen} KI · ${recOpen} Recruiting`}
          accent="cyan"
          icon={IconTarget}
        />
        <StatCard
          label="Gewichtetes Potenzial"
          value={formatEur(weighted)}
          hint="nach Wahrscheinlichkeit"
          accent="success"
          icon={IconTrendingUp}
        />
        <StatCard
          label="Recruiting-Volumen"
          value={formatEur(recVolume)}
          hint="Festpreis offener Mandate"
          accent="purple"
          icon={IconEuro}
        />
        <StatCard
          label="Abschlussquote (90T)"
          value="42 %"
          hint="gewonnen vs. qualifiziert"
          accent="neutral"
          icon={IconTrendingUp}
        />
      </div>

      <KanbanBoard
        columns={COLUMNS}
        items={opps.filter((o) => o.stage !== "verloren")}
        getStage={(o) => o.stage}
        renderCard={(o) => <OppCard o={o} />}
        columnFooter={(items) => (
          <>{formatEur(items.reduce((s, o) => s + o.value, 0))}</>
        )}
        emptyText="Noch keine Verkaufschancen. Lege deine erste Chance an."
      />
    </div>
  );
}
