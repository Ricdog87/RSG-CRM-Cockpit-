import { PageHeader } from "@/components/cockpit/PageHeader";
import { ImportWizard } from "@/components/cockpit/ImportWizard";

export const dynamic = "force-dynamic";

export default function ImportPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Datenintegration"
        title="Import"
        description="CSV-Direktimport für Kunden, Kandidaten, Ansprechpartner und Projekte – mit Spaltenzuordnung, Dublettenabgleich und Aktualisierung vorhandener Datensätze."
      />
      <ImportWizard />
    </div>
  );
}
