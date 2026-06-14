import { getOpportunities } from "@/lib/crm-data";
import { createOpportunity } from "@/lib/crm-actions";
import { PageHeader } from "@/components/cockpit/PageHeader";
import { StatCard } from "@/components/cockpit/StatCard";
import { SalesView } from "@/components/cockpit/views/SalesView";
import { EntityFormDialog, type FormField } from "@/components/cockpit/EntityFormDialog";
import { IconTarget, IconEuro, IconTrendingUp } from "@/components/ui/icons";
import { formatEur } from "@/lib/format";

export const dynamic = "force-dynamic";

const FIELDS: FormField[] = [
  { name: "account_name", label: "Account", required: true, full: true, placeholder: "Muster GmbH" },
  { name: "title", label: "Titel", full: true, placeholder: "z.B. AI Account Manager" },
  {
    name: "line",
    label: "Geschäftslinie",
    type: "select",
    options: [
      { value: "ki", label: "KI & Telefonassistenz" },
      { value: "recruiting", label: "Personalvermittlung" },
    ],
  },
  {
    name: "value_type",
    label: "Wert-Typ",
    type: "select",
    options: [
      { value: "mrr", label: "MRR (monatlich)" },
      { value: "fixed", label: "Festpreis" },
    ],
  },
  { name: "value", label: "Wert (€)", type: "number", placeholder: "0" },
  { name: "probability", label: "Wahrscheinlichkeit (%)", type: "number", placeholder: "0" },
  {
    name: "stage",
    label: "Phase",
    type: "select",
    options: [
      { value: "neu", label: "Neu" },
      { value: "qualifiziert", label: "Qualifiziert" },
      { value: "demo", label: "Demo/Termin" },
      { value: "angebot", label: "Angebot" },
      { value: "verhandlung", label: "Verhandlung" },
      { value: "gewonnen", label: "Gewonnen" },
    ],
  },
  { name: "owner", label: "Verantwortlich" },
  { name: "expected_close", label: "Erwarteter Abschluss", type: "date" },
];

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
          <EntityFormDialog
            triggerLabel="Chance anlegen"
            title="Neue Verkaufschance"
            description="Projekt-Opportunity über KI oder Recruiting erfassen."
            fields={FIELDS}
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

      <SalesView opportunities={opps} />
    </div>
  );
}
