import { getCockpitData } from "@/lib/data";
import { PageHeader } from "@/components/cockpit/PageHeader";
import { StatCard } from "@/components/cockpit/StatCard";
import { OverrideNudge } from "@/components/cockpit/OverrideNudge";
import { Card, CardBody, SectionHeader } from "@/components/ui/Card";
import { BestandChart } from "@/components/cockpit/BestandChart";
import { IconEuro, IconCheck, IconAlert, IconNetwork } from "@/components/ui/icons";
import { formatEur } from "@/lib/format";

export const dynamic = "force-dynamic";

const PROVISIONSARTEN = [
  { name: "Setup-Provision (KI)", rate: "60 % des Setup-Fees", note: "einmalig, 50 % Stornoreserve" },
  { name: "Bestandsprovision (KI)", rate: "17 % MRR / Monat", note: "wiederkehrend, solange Vertrag läuft" },
  { name: "Recruiting", rate: "25–32 % je Stufe", note: "auf 9.999 € Festpreis" },
  { name: "Override", rate: "5 % je Ebene · max. 2", note: "aus realem Produktumsatz der Downline" },
];

export default async function ProvisionenPage() {
  const { earnings, bestandsverlauf, provisionAktuellerMonat, override } =
    await getCockpitData();

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Vergütung"
        title="Provisionen"
        description="Gutschriftsverfahren · freigegebene Beträge werden zum 15. des Folgemonats ausgezahlt (§4)."
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          label="Diesen Monat"
          value={formatEur(provisionAktuellerMonat)}
          hint="laufender Abrechnungsmonat"
          accent="purple"
          icon={IconEuro}
        />
        <StatCard
          label="Offen freigegeben"
          value={formatEur(earnings.offen_freigegeben)}
          hint="zur Auszahlung am 15."
          accent="cyan"
          icon={IconCheck}
        />
        <StatCard
          label="Stornoreserve"
          value={formatEur(earnings.in_stornoreserve)}
          hint="Freigabe nach 6 Monaten (§5)"
          accent="warning"
          icon={IconAlert}
        />
        <StatCard
          label="Override pausiert"
          value={formatEur(earnings.override_pausiert)}
          hint={
            earnings.override_pausiert > 0
              ? "Mindestaktivität nicht erfüllt"
              : "Override läuft"
          }
          accent={earnings.override_pausiert > 0 ? "warning" : "success"}
          icon={IconNetwork}
        />
      </div>

      <OverrideNudge earnings={earnings} override={override} />

      <div className="grid gap-6 lg:grid-cols-5">
        <div className="lg:col-span-3">
          <Card>
            <CardBody>
              <SectionHeader
                title="Bestandsentwicklung"
                hint="Monatliche Bestandsprovision der letzten 12 Monate"
              />
              <BestandChart data={bestandsverlauf} />
            </CardBody>
          </Card>
        </div>

        <div className="lg:col-span-2">
          <Card className="h-full">
            <CardBody>
              <SectionHeader title="Provisionsarten" hint="laut Provisionsordnung" />
              <ul className="space-y-3">
                {PROVISIONSARTEN.map((p) => (
                  <li
                    key={p.name}
                    className="flex items-start justify-between gap-3 border-b border-border/60 pb-3 last:border-0 last:pb-0"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-ink">{p.name}</p>
                      <p className="text-xs text-faint">{p.note}</p>
                    </div>
                    <span className="flex-none text-right text-sm font-semibold text-cyan-soft">
                      {p.rate}
                    </span>
                  </li>
                ))}
              </ul>
              <p className="mt-4 rounded-lg border border-border/60 bg-elevated/40 px-3 py-2 text-[0.7rem] leading-relaxed text-faint">
                Maßgeblich sind die im Ledger gebuchten Beträge. Sätze gemäß
                Provisionsordnung (Anlage 1), Anpassungen vorbehalten.
              </p>
            </CardBody>
          </Card>
        </div>
      </div>
    </div>
  );
}
