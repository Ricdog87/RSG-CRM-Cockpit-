import { Card, CardBody, SectionHeader } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { formatNumber } from "@/lib/format";
import type { CareerState } from "@/lib/types";

function ProgressBar({ value, max }: { value: number; max: number }) {
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 100;
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-elevated">
      <div
        className="h-full rounded-full bg-gradient-to-r from-purple to-cyan transition-all"
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

/**
 * Karriere-Fortschritt. Stufe + freigeschaltete Override-Ebenen (§2
 * Provisionsordnung). Fortschritt = aktive Direktpartner:innen gegen die
 * Mindestaktivität der Stufe (§6); darunter ruht der Override.
 */
export function CareerProgress({ career }: { career: CareerState }) {
  const { current, next, active_direct_count, min_active_directs } = career;
  const fehlend = Math.max(0, min_active_directs - active_direct_count);
  const erfuellt = min_active_directs === 0 || active_direct_count >= min_active_directs;

  return (
    <Card>
      <CardBody>
        <SectionHeader title="Karriere" />

        <div className="mb-5 flex items-center justify-between">
          <div>
            <p className="text-xs text-faint">Aktuelle Stufe</p>
            <p className="text-lg font-bold text-ink">{current.name}</p>
          </div>
          <Badge tone="purple">Stufe {current.level}</Badge>
        </div>

        <div className="mb-5 flex items-center gap-2">
          <Badge tone="cyan">
            {current.override_levels > 0
              ? `Override · ${current.override_levels} ${
                  current.override_levels === 1 ? "Ebene" : "Ebenen"
                }`
              : "Noch keine Override-Ebene"}
          </Badge>
          {next ? (
            <span className="text-xs text-faint">
              nächste Stufe: <span className="text-muted">{next.name}</span>
            </span>
          ) : null}
        </div>

        {min_active_directs > 0 ? (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-medium text-faint">
                Aktive Direktpartner:innen
              </span>
              <span className="text-muted">
                {formatNumber(active_direct_count)} / {formatNumber(min_active_directs)}
              </span>
            </div>
            <ProgressBar value={active_direct_count} max={min_active_directs} />
            <p className="text-sm text-muted">
              {erfuellt ? (
                <>Mindestaktivität erfüllt – dein Override läuft.</>
              ) : (
                <>
                  Noch{" "}
                  <span className="font-semibold text-cyan-soft">
                    {fehlend} aktive:r Direktpartner:in
                  </span>{" "}
                  bis dein Override wieder aktiv ist.
                </>
              )}
            </p>
          </div>
        ) : (
          <p className="rounded-xl border border-purple/20 bg-purple/5 px-4 py-3 text-sm text-purple-soft">
            {next
              ? "Gewinne deine ersten aktiven Direktpartner:innen, um die nächste Stufe und deinen Override freizuschalten."
              : "Höchste Stufe erreicht. Jetzt zählt die Breite und Tiefe deines Teams."}
          </p>
        )}
      </CardBody>
    </Card>
  );
}
