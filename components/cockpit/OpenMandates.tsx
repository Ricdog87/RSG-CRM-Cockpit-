import Link from "next/link";
import { Card, CardBody, SectionHeader } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { IconChevronRight, IconBriefcase } from "@/components/ui/icons";
import { formatEur } from "@/lib/format";
import {
  mandateRevenue,
  type MandateStatus,
  type RecruitingMandate,
} from "@/lib/crm-types";

const statusMeta: Record<
  MandateStatus,
  { label: string; tone: "neutral" | "sky" | "brand" | "success" | "warning" }
> = {
  angebot: { label: "Angebot", tone: "neutral" },
  offen: { label: "Offen", tone: "neutral" },
  in_arbeit: { label: "In Arbeit", tone: "sky" },
  interviews: { label: "Interviews", tone: "brand" },
  besetzt: { label: "Besetzt", tone: "success" },
  pausiert: { label: "Pausiert", tone: "warning" },
};

/** Offenes Honorarvolumen eines Mandats (noch nicht besetzte Stellen). */
function openValue(m: RecruitingMandate): number {
  const offen = Math.max(0, (m.positions || 0) - (m.filled || 0));
  const perPos = m.positions > 0 ? mandateRevenue(m) / m.positions : 0;
  return Math.round(offen * perPos);
}

/**
 * Dashboard-Kachel: offene Recruiting-Mandate (Suchaufträge) – ergänzt die
 * Sales-Pipeline (Deals), damit beides auf einen Blick zusammenpasst.
 */
export function OpenMandates({
  mandates,
  limit = 5,
}: {
  mandates: RecruitingMandate[];
  limit?: number;
}) {
  const open = mandates.filter(
    (m) => m.status !== "besetzt" && m.status !== "angebot" && m.filled < m.positions
  );
  const totalOpen = open.reduce((sum, m) => sum + openValue(m), 0);
  const shown = open.slice(0, limit);

  return (
    <Card>
      <CardBody>
        <SectionHeader
          title="Offene Mandate"
          hint={
            open.length > 0
              ? `${open.length} aktiv · ${formatEur(totalOpen)} offenes Honorar`
              : undefined
          }
          action={
            <Link
              href="/cockpit/projekte/recruiting"
              className="inline-flex items-center gap-1 text-xs font-semibold text-sky-deep hover:text-sky-ink"
            >
              Alle ansehen <IconChevronRight size={14} />
            </Link>
          }
        />

        {shown.length === 0 ? (
          <EmptyState
            icon={<IconBriefcase size={20} />}
            title="Keine offenen Mandate. Lege unter Projekte → Recruiting deinen ersten Suchauftrag an."
          />
        ) : (
          <ul className="divide-y divide-border">
            {shown.map((m) => {
              const st = statusMeta[m.status] ?? statusMeta.offen;
              const offen = Math.max(0, m.positions - m.filled);
              return (
                <li key={m.id} className="py-3 first:pt-0 last:pb-0">
                  <Link
                    href={`/cockpit/projekte/recruiting/${m.id}`}
                    className="flex items-center justify-between gap-3"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-ink">{m.role || "Mandat"}</p>
                      <p className="truncate text-xs text-muted">
                        {m.account_name} · {offen} offen / {m.positions}
                      </p>
                    </div>
                    <div className="flex flex-none items-center gap-3">
                      <div className="hidden text-right sm:block">
                        <p className="text-sm font-semibold text-ink">{formatEur(openValue(m))}</p>
                        <p className="text-xs text-faint">offen</p>
                      </div>
                      <Badge tone={st.tone}>{st.label}</Badge>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </CardBody>
    </Card>
  );
}
