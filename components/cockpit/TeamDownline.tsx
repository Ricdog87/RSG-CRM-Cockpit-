import { Card, CardBody, SectionHeader } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { formatEur, formatNumber } from "@/lib/format";
import type { DownlinePartner } from "@/lib/types";

/** Team/Downline: partners where upline_id = eigene id. */
export function TeamDownline({ team }: { team: DownlinePartner[] }) {
  const aktive = team.filter((p) => p.is_active).length;

  return (
    <Card>
      <CardBody>
        <SectionHeader
          title="Team"
          hint={
            team.length > 0
              ? `${aktive} von ${team.length} Direktpartner:innen aktiv`
              : undefined
          }
        />

        {team.length === 0 ? (
          <EmptyState
            title="Du hast noch keine Direktpartner:innen. Gewinne deine erste Empfehlung, um Override aufzubauen."
            action={<Button variant="ghost">Partner:in einladen</Button>}
          />
        ) : (
          <ul className="space-y-2">
            {team.map((member) => (
              <li
                key={member.partner_id}
                className="flex items-center gap-3 rounded-xl border border-border bg-elevated/40 px-3 py-2.5"
              >
                <span className="flex h-9 w-9 flex-none items-center justify-center rounded-full bg-gradient-to-br from-purple/30 to-cyan/30 text-sm font-bold text-ink">
                  {member.full_name.charAt(0).toUpperCase()}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-ink">
                    {member.full_name}
                  </p>
                  <p className="truncate text-xs text-muted">
                    {formatNumber(member.aktive_kunden)} Kund:innen ·{" "}
                    {formatEur(member.mrr_bestand)} Bestand
                  </p>
                </div>
                <Badge tone={member.is_active ? "success" : "warning"}>
                  {member.is_active ? "Aktiv" : "Inaktiv"}
                </Badge>
              </li>
            ))}
          </ul>
        )}
      </CardBody>
    </Card>
  );
}
