import { PageHeader } from "@/components/cockpit/PageHeader";
import { ImportWizard } from "@/components/cockpit/ImportWizard";

export const dynamic = "force-dynamic";

export default function ImportPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Datenintegration"
        title="Import"
        description="CSV-Direktimport für Datensätze (Kunden, Kandidaten, Ansprechpartner, Projekte) und Aktivitäten (Notizen, Anrufe, Meetings, Aufgaben) – mit Spaltenzuordnung, Dublettenabgleich, Aktualisierung und Beispieldateien."
      />
      <ImportWizard />
    </div>
  );
}
