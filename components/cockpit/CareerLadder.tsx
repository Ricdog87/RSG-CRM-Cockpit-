import { Card, CardBody, SectionHeader } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { IconCheck } from "@/components/ui/icons";
import { cn } from "@/components/ui/cn";

// Stufenplan laut Provisionsordnung §2 (Anlage 1) – Referenzdarstellung.
const STUFEN = [
  {
    level: 1,
    name: "RSG Partner",
    aufstieg: "Einstieg nach Zertifizierung",
    override: "Keine Override-Ebene",
  },
  {
    level: 2,
    name: "Senior Partner",
    aufstieg: "5 aktive Direktpartner:innen",
    override: "Override-Ebene 1",
  },
  {
    level: 3,
    name: "Director",
    aufstieg: "≥ 2 eigene Team Leads in der Tiefe",
    override: "Override-Ebenen 1 + 2",
  },
  {
    level: 4,
    name: "Equity Circle",
    aufstieg: "Einladung (Top-Performer)",
    override: "Ebenen 1 + 2 + Bonuspool",
  },
];

/** Vertikaler Stufenplan mit hervorgehobener aktueller Stufe. */
export function CareerLadder({ currentLevel }: { currentLevel: number }) {
  return (
    <Card>
      <CardBody>
        <SectionHeader title="Stufenplan" hint="Provisionsordnung §2" />
        <ol className="relative space-y-3">
          {STUFEN.map((s) => {
            const done = s.level < currentLevel;
            const active = s.level === currentLevel;
            return (
              <li
                key={s.level}
                className={cn(
                  "flex items-start gap-3 rounded-xl border px-3 py-3 transition-colors",
                  active
                    ? "border-purple/40 bg-purple/10"
                    : "border-border/60 bg-elevated/30"
                )}
              >
                <span
                  className={cn(
                    "flex h-8 w-8 flex-none items-center justify-center rounded-lg text-sm font-bold",
                    active
                      ? "bg-gradient-to-br from-purple to-cyan text-white"
                      : done
                        ? "bg-success/15 text-success"
                        : "bg-elevated text-faint"
                  )}
                >
                  {done ? <IconCheck size={16} /> : s.level}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p
                      className={cn(
                        "text-sm font-semibold",
                        active ? "text-ink" : "text-muted"
                      )}
                    >
                      {s.name}
                    </p>
                    {active ? <Badge tone="purple">Aktuell</Badge> : null}
                  </div>
                  <p className="mt-0.5 text-xs text-faint">Aufstieg: {s.aufstieg}</p>
                  <p className="text-xs text-cyan-soft">{s.override}</p>
                </div>
              </li>
            );
          })}
        </ol>
      </CardBody>
    </Card>
  );
}
