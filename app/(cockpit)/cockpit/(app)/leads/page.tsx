import { PageHeader } from "@/components/cockpit/PageHeader";
import { LeadIntelligence } from "@/components/cockpit/LeadIntelligence";
import { LeadDiscovery } from "@/components/cockpit/LeadDiscovery";
import { aiConfigured, webResearchEnabled } from "@/lib/ai/config";

export const dynamic = "force-dynamic";

export default function LeadsPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="KI · Lead Intelligence"
        title="Intelligente B2B-Leads"
        description="Bewerte ein Unternehmen in Sekunden: Fit-Score, passende Linie, Signale und ein fertiger Erstkontakt – auf RSG zugeschnitten."
      />
      <LeadIntelligence
        aiConfigured={aiConfigured}
        webResearchEnabled={webResearchEnabled}
      />

      <LeadDiscovery />
    </div>
  );
}
