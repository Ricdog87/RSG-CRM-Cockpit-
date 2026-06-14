import { Card, CardBody, SectionHeader } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { cn } from "@/components/ui/cn";
import { formatEur } from "@/lib/format";
import type { LeaderboardRow } from "@/lib/types";

/** Leaderboard aus v_leaderboard. Eigene Zeile ist hervorgehoben. */
export function Leaderboard({ rows }: { rows: LeaderboardRow[] }) {
  return (
    <Card>
      <CardBody>
        <SectionHeader title="Leaderboard" hint="Bestand im Vergleich" />

        {rows.length === 0 ? (
          <EmptyState title="Sobald genug Partner:innen abrechnen, erscheint hier dein Rang." />
        ) : (
          <ul className="space-y-1.5">
            {rows.map((row) => (
              <li
                key={row.partner_id}
                className={cn(
                  "flex items-center gap-3 rounded-xl px-3 py-2.5",
                  row.is_self
                    ? "border border-purple/30 bg-purple/10"
                    : "hover:bg-elevated"
                )}
              >
                <span
                  className={cn(
                    "flex h-7 w-7 flex-none items-center justify-center rounded-lg text-xs font-bold",
                    row.rank <= 3
                      ? "bg-gradient-to-br from-purple to-cyan text-white"
                      : "bg-elevated text-muted"
                  )}
                >
                  {row.rank}
                </span>
                <span
                  className={cn(
                    "min-w-0 flex-1 truncate text-sm",
                    row.is_self ? "font-semibold text-ink" : "text-muted"
                  )}
                >
                  {row.full_name}
                  {row.is_self ? (
                    <span className="ml-1.5 text-xs text-purple-soft">· du</span>
                  ) : null}
                </span>
                <div className="flex-none text-right">
                  <p className="text-sm font-semibold text-ink">
                    {formatEur(row.mrr_bestand)}
                  </p>
                  <p className="text-xs text-faint">
                    {formatEur(row.provision_90d)} · 90 Tage
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardBody>
    </Card>
  );
}
