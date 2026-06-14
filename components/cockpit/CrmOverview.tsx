import Link from "next/link";
import { StatCard } from "@/components/cockpit/StatCard";
import { SectionHeader } from "@/components/ui/Card";
import { IconChevronRight, IconTarget, IconPhone, IconBriefcase, IconUserCheck } from "@/components/ui/icons";
import { formatEur, formatNumber } from "@/lib/format";
import type { Candidate, KiProject, Opportunity, RecruitingMandate } from "@/lib/crm-types";

/** CRM-Kennzahlen über Vertrieb & Projekte für die Übersicht. */
export function CrmOverview({
  opportunities,
  kiProjects,
  mandates,
  candidates,
}: {
  opportunities: Opportunity[];
  kiProjects: KiProject[];
  mandates: RecruitingMandate[];
  candidates: Candidate[];
}) {
  const openOpps = opportunities.filter(
    (o) => o.stage !== "gewonnen" && o.stage !== "verloren"
  );
  const weighted = openOpps.reduce((s, o) => s + (o.value * o.probability) / 100, 0);

  const live = kiProjects.filter((p) => p.status === "live").length;
  const onboarding = kiProjects.filter((p) => p.status === "onboarding").length;

  const openPositions = mandates.reduce(
    (s, m) => s + Math.max(0, m.positions - m.filled),
    0
  );
  const openVolume = mandates.reduce(
    (s, m) => s + Math.max(0, m.positions - m.filled) * m.fee,
    0
  );

  const candAktiv = candidates.filter(
    (c) => c.stage !== "platziert" && c.stage !== "abgelehnt"
  ).length;
  const interviews = candidates.filter((c) => c.stage === "interview").length;

  return (
    <div>
      <SectionHeader
        title="Vertrieb & Projekte"
        action={
          <Link
            href="/cockpit/sales"
            className="inline-flex items-center gap-1 text-xs font-semibold text-sky-deep hover:text-sky-ink"
          >
            Zur Pipeline <IconChevronRight size={14} />
          </Link>
        }
      />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          label="Offene Chancen"
          value={formatNumber(openOpps.length)}
          hint={`${formatEur(weighted)} gewichtet`}
          accent="sky"
          icon={IconTarget}
        />
        <StatCard
          label="KI-Projekte live"
          value={formatNumber(live)}
          hint={`${formatNumber(onboarding)} im Onboarding`}
          accent="brand"
          icon={IconPhone}
        />
        <StatCard
          label="Offene Stellen"
          value={formatNumber(openPositions)}
          hint={`${formatEur(openVolume)} Volumen`}
          accent="warning"
          icon={IconBriefcase}
        />
        <StatCard
          label="Kandidaten aktiv"
          value={formatNumber(candAktiv)}
          hint={`${formatNumber(interviews)} in Interviews`}
          accent="success"
          icon={IconUserCheck}
        />
      </div>
    </div>
  );
}
