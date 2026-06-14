import { Card, CardBody, SectionHeader } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { formatNumber } from "@/lib/format";
import type { CareerState } from "@/lib/types";

function ProgressBar({ value, max }: { value: number; max: number }) {
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 100;
  return (
    <div className="space-y-1.5">
      <div className="h-2 w-full overflow-hidden rounded-full bg-elevated">
        <div
          className="h-full rounded-full bg-gradient-to-r from-purple to-cyan transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className="text-xs text-muted">
        {formatNumber(value)} von {formatNumber(max)}
      </p>
    </div>
  );
}

/** Karriere-Fortschritt: aktuelle Stufe + was zur nächsten fehlt. */
export function CareerProgress({ career }: { career: CareerState }) {
  const { current, next, own_active, active_direct_count } = career;

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

        {next ? (
          <div className="space-y-4">
            <p className="text-sm text-muted">
              Nächste Stufe:{" "}
              <span className="font-semibold text-ink">{next.name}</span>
            </p>
            <div>
              <p className="mb-1.5 text-xs font-medium text-faint">
                Eigener aktiver Bestand
              </p>
              <ProgressBar value={own_active} max={next.min_own_active} />
            </div>
            <div>
              <p className="mb-1.5 text-xs font-medium text-faint">
                Aktive Direktpartner:innen
              </p>
              <ProgressBar
                value={active_direct_count}
                max={next.min_active_directs}
              />
            </div>
          </div>
        ) : (
          <p className="rounded-xl border border-purple/20 bg-purple/5 px-4 py-3 text-sm text-purple-soft">
            Höchste Stufe erreicht. Stark — jetzt geht es um die Breite deines
            Teams.
          </p>
        )}
      </CardBody>
    </Card>
  );
}
