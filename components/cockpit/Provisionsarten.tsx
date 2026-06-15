import { Card, CardBody } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { cn } from "@/components/ui/cn";

/**
 * Kanonische Provisionssätze laut Provisionsordnung (Anlage 1) / rsg-ai.de/partner.
 * WICHTIG: Setup + Bestand sind STUFENBASIERT (nicht flach).
 * `currentStufe` (optional) hebt die aktuelle Stufe hervor – Abgleich über den Namen.
 */

type StufenSatz = {
  name: string;
  setup: number; // Setup-% (KI)
  bestand: number; // Bestands-%/Monat (KI)
  aufstieg: string; // Schwelle: eigene aktive Bestandskunden
};

export const STUFEN_SAETZE: StufenSatz[] = [
  { name: "RSG Partner", setup: 20, bestand: 10, aufstieg: "Einstieg" },
  { name: "Senior Partner", setup: 23, bestand: 13, aufstieg: "ab 6" },
  { name: "Director", setup: 27, bestand: 17, aufstieg: "ab 15" },
  { name: "Equity Circle", setup: 30, bestand: 22, aufstieg: "ab 30" },
];

const norm = (s?: string) => (s ?? "").trim().toLowerCase();

export function Provisionsarten({ currentStufe }: { currentStufe?: string }) {
  return (
    <Card>
      <CardBody className="space-y-4">
        <div>
          <p className="eyebrow">Provisionsarten</p>
          <h3 className="text-lg font-semibold text-ink">Sätze nach Karrierestufe</h3>
          <p className="text-sm text-muted">
            Setup- und Bestandsprovision steigen mit deiner Stufe. Aufstieg
            automatisch nach eigenen aktiven Bestandskunden.
          </p>
        </div>

        {/* Stufen-Tabelle (KI: Setup + Bestand) – horizontal scrollbar auf Mobile */}
        <div className="-mx-1 overflow-x-auto">
          <div className="min-w-[28rem] overflow-hidden rounded-xl border border-border">
            <table className="w-full text-sm">
              <thead className="bg-elevated text-faint">
                <tr>
                  <th className="px-3 py-2 text-left font-medium">Stufe</th>
                  <th className="px-3 py-2 text-center font-medium">Aufstieg</th>
                  <th className="px-3 py-2 text-right font-medium">Setup</th>
                  <th className="px-3 py-2 text-right font-medium">Bestand/Mon</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/70">
                {STUFEN_SAETZE.map((s) => {
                  const active = norm(currentStufe) === norm(s.name);
                  return (
                    <tr key={s.name} className={cn(active && "bg-brand/[0.07]")}>
                      <td className="px-3 py-2.5 font-medium text-ink">
                        <span className="flex items-center gap-2">
                          {s.name}
                          {active ? <Badge tone="brand">deine Stufe</Badge> : null}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-center text-muted">{s.aufstieg}</td>
                      <td
                        className={cn(
                          "px-3 py-2.5 text-right tabular-nums",
                          active ? "font-semibold text-ink" : "text-ink"
                        )}
                      >
                        {s.setup} %
                      </td>
                      <td
                        className={cn(
                          "px-3 py-2.5 text-right tabular-nums",
                          active ? "font-semibold text-brand-deep" : "text-ink"
                        )}
                      >
                        {s.bestand} %
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Recruiting + Override */}
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-xl border border-border p-3">
            <p className="text-sm font-medium text-ink">Recruiting</p>
            <p className="text-xs text-faint">auf 9.999 € Festpreis</p>
            <p className="mt-1 text-sm font-semibold text-brand-deep">25–32 % je Stufe</p>
          </div>
          <div className="rounded-xl border border-border p-3">
            <p className="text-sm font-medium text-ink">Override</p>
            <p className="text-xs text-faint">
              aus realem Produktumsatz der Downline (intern)
            </p>
            <p className="mt-1 text-sm font-semibold text-brand-deep">5 % je Ebene · max. 2</p>
          </div>
        </div>

        <p className="text-xs text-faint">
          Maßgeblich sind die im Ledger gebuchten Beträge (Quelle: products /
          career_levels). Sätze gemäß Provisionsordnung (Anlage 1) · 50 %
          Stornoreserve auf die Setup-Provision (§ 5), Anpassungen vorbehalten.
        </p>
      </CardBody>
    </Card>
  );
}
