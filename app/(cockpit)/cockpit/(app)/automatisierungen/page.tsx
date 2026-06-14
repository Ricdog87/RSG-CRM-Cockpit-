import { AUTOMATIONS, getAutomationsMap } from "@/lib/automations";
import { isSupabaseConfigured } from "@/lib/env";
import { PageHeader } from "@/components/cockpit/PageHeader";
import { AutomationsView } from "@/components/cockpit/AutomationsView";

export const dynamic = "force-dynamic";

export default async function AutomatisierungenPage() {
  const map = await getAutomationsMap();
  const items = AUTOMATIONS.map((a) => ({ ...a, enabled: map[a.key] ?? true }));

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Workflows"
        title="Automatisierungen"
        description="Regelbasierte Abläufe – die KI/CRM-Logik erledigt Routine automatisch im Hintergrund."
      />

      {!isSupabaseConfigured ? (
        <p className="rounded-xl border border-warning/30 bg-warning/10 px-3 py-2 text-xs text-warning">
          Demo-Modus: Regeln lassen sich umschalten, greifen aber erst mit
          verbundener Supabase (die Aktionen laufen serverseitig).
        </p>
      ) : null}

      <AutomationsView items={items} />
    </div>
  );
}
