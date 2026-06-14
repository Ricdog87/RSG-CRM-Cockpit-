import { getOpportunities, getAccounts } from "@/lib/crm-data";
import { createOpportunity } from "@/lib/crm-actions";
import { PageHeader } from "@/components/cockpit/PageHeader";
import { StatCard } from "@/components/cockpit/StatCard";
import { SalesView } from "@/components/cockpit/views/SalesView";
import { PipelinePriorities } from "@/components/cockpit/PipelinePriorities";
import { EntityFormDialog } from "@/components/cockpit/EntityFormDialog";
import { OPPORTUNITY_FIELDS, withDatalist } from "@/lib/crm-forms";
import { IconTarget, IconEuro, IconTrendingUp } from "@/components/ui/icons";
import { formatEur } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function SalesPage() {
  const [opps, accounts] = await Promise.all([getOpportunities(), getAccounts()]);
  const fields = withDatalist(
    OPPORTUNITY_FIELDS,
    "account_name",
    accounts.map((a) => a.name)
  );
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
          <EntityFormDialog
            triggerLabel="Chance anlegen"
            title="Neue Verkaufschance"
            description="Projekt-Opportunity über KI oder Recruiting erfassen."
            fields={fields}
            action={createOpportunity}
          />
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          label="Offene Chancen"
          value={`${open.length}`}
          hint={`${kiOpen} KI · ${recOpen} Recruiting`}
          accent="sky"
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
          accent="brand"
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

      <PipelinePriorities />

      <SalesView opportunities={opps} />
    </div>
  );
}
