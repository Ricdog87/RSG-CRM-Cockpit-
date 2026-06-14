import { getCockpitData } from "@/lib/data";
import { PageHeader } from "@/components/cockpit/PageHeader";
import { StatCard } from "@/components/cockpit/StatCard";
import { OverrideNudge } from "@/components/cockpit/OverrideNudge";
import { Card, CardBody, SectionHeader } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { BestandChart } from "@/components/cockpit/BestandChart";
import { IconEuro, IconCheck, IconAlert, IconNetwork } from "@/components/ui/icons";
import { formatEur } from "@/lib/format";
import { cn } from "@/components/ui/cn";

export const dynamic = "force-dynamic";

// Stufenplan-Sätze (KI). Quelle: rsg-ai.de/partner + Provisionsordnung Anlage 1.
const STUFEN = [
  { level: 1, name: "RSG Partner", setup: "20 %", bestand: "10 %" },
  { level: 2, name: "Senior Partner", setup: "23 %", bestand: "13 %" },
  { level: 3, name: "Director", setup: "27 %", bestand: "17 %" },
  { level: 4, name: "Equity Circle", setup: "30 %", bestand: "22 %" },
];

export default async function ProvisionenPage() {
  const { earnings, bestandsverlauf, provisionAktuellerMonat, override, career } =
    await getCockpitData();
  const currentLevel = career.current.level;

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
          accent="brand"
          icon={IconEuro}
        />
        <StatCard
          label="Offen freigegeben"
          value={formatEur(earnings.offen_freigegeben)}
          hint="zur Auszahlung am 15."
          accent="sky"
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
              <SectionHeader title="Provisionsstufen (KI)" hint="Setup & Bestand je Stufe" />

              <div className="grid grid-cols-[1fr_auto_auto] gap-x-3 text-sm">
                <span className="pb-1.5 text-xs font-medium uppercase tracking-wider text-faint">
                  Stufe
                </span>
                <span className="pb-1.5 text-right text-xs font-medium uppercase tracking-wider text-faint">
                  Setup
                </span>
                <span className="pb-1.5 text-right text-xs font-medium uppercase tracking-wider text-faint">
                  Bestand
                </span>
                {STUFEN.map((s) => {
                  const active = s.level === currentLevel;
                  return (
                    <div
                      key={s.level}
                      className={cn(
                        "col-span-3 grid grid-cols-[1fr_auto_auto] items-center gap-x-3 rounded-lg px-2 py-2",
                        active
                          ? "bg-brand/10 ring-1 ring-brand/30"
                          : "border-b border-border/50"
                      )}
                    >
                      <span className={cn("flex items-center gap-1.5 truncate", active ? "font-semibold text-ink" : "text-muted")}>
                        {s.name}
                        {active ? <Badge tone="brand">deine Stufe</Badge> : null}
                      </span>
                      <span className={cn("text-right tabular-nums", active ? "font-semibold text-ink" : "text-muted")}>
                        {s.setup}
                      </span>
                      <span className={cn("text-right tabular-nums", active ? "font-semibold text-brand-deep" : "text-muted")}>
                        {s.bestand}
                      </span>
                    </div>
                  );
                })}
              </div>

              <div className="mt-4 space-y-1.5 border-t border-border/60 pt-3 text-xs text-muted">
                <p>
                  <span className="font-medium text-ink">Recruiting:</span> 25–32 %
                  je Stufe auf 9.999 € Festpreis je Besetzung.
                </p>
                <p>
                  <span className="font-medium text-ink">Override:</span> 5 % je
                  Ebene, max. 2 – aus realem Produktumsatz der Downline.
                </p>
              </div>

              <p className="mt-4 rounded-lg border border-border/60 bg-elevated/40 px-3 py-2 text-[0.7rem] leading-relaxed text-faint">
                Maßgeblich sind die im Ledger gebuchten Beträge (Quelle:
                products / career_levels). Sätze laut rsg-ai.de/partner +
                Provisionsordnung (Anlage 1), Anpassungen vorbehalten.
              </p>
            </CardBody>
          </Card>
        </div>
      </div>
    </div>
  );
}
