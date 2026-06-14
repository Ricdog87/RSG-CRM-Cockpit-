import { getSegments } from "@/lib/crm-data";
import { createSegment } from "@/lib/crm-actions";
import { PageHeader } from "@/components/cockpit/PageHeader";
import { StatCard } from "@/components/cockpit/StatCard";
import { SegmentsView } from "@/components/cockpit/views/SegmentsView";
import { EntityFormDialog } from "@/components/cockpit/EntityFormDialog";
import { SEGMENT_FIELDS } from "@/lib/crm-forms";
import { IconLayers, IconUsers, IconEuro } from "@/components/ui/icons";
import { formatEur, formatNumber } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function SegmentePage() {
  const segments = await getSegments();
  const totalAccounts = segments.reduce((s, x) => s + x.accounts, 0);
  const totalMrr = segments.reduce((s, x) => s + x.mrr, 0);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Vertrieb"
        title="Segmente"
        description="KI-Zielgruppen nach Branche und Use-Case – Basis für gezielte Ansprache."
        action={
          <EntityFormDialog
            triggerLabel="Segment anlegen"
            title="Neues Segment"
            description="KI-Zielgruppe nach Branche/Use-Case erfassen."
            fields={SEGMENT_FIELDS}
            action={createSegment}
          />
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        <StatCard
          label="Segmente"
          value={formatNumber(segments.length)}
          hint="aktive Zielgruppen"
          accent="sky"
          icon={IconLayers}
        />
        <StatCard
          label="Accounts gesamt"
          value={formatNumber(totalAccounts)}
          hint="über alle Segmente"
          accent="brand"
          icon={IconUsers}
        />
        <StatCard
          label="MRR gesamt"
          value={`${formatEur(totalMrr)}/M`}
          hint="wiederkehrender Umsatz"
          accent="success"
          icon={IconEuro}
        />
      </div>

      <SegmentsView segments={segments} />
    </div>
  );
}
