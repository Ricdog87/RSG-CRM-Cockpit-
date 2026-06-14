import { getCockpitData } from "@/lib/data";
import { PageHeader } from "@/components/cockpit/PageHeader";
import { TeamDownline } from "@/components/cockpit/TeamDownline";
import { OverrideNudge } from "@/components/cockpit/OverrideNudge";
import { StatCard } from "@/components/cockpit/StatCard";
import { Button } from "@/components/ui/Button";
import { IconNetwork, IconUsers, IconEuro, IconPlus } from "@/components/ui/icons";
import { formatEur, formatNumber } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function TeamPage() {
  const { downline, earnings, override } = await getCockpitData();

  const aktive = downline.filter((d) => d.is_active);
  const teamKunden = downline.reduce((s, d) => s + d.aktive_kunden, 0);
  const teamBestand = downline.reduce((s, d) => s + d.mrr_bestand, 0);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Struktur"
        title="Team"
        description="Deine direkten Partner:innen und ihr Beitrag zu deinem Override."
        action={
          <Button>
            <IconPlus size={16} /> Partner:in einladen
          </Button>
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          label="Direktpartner:innen"
          value={formatNumber(downline.length)}
          hint={`${formatNumber(aktive.length)} aktiv`}
          accent="brand"
          icon={IconNetwork}
        />
        <StatCard
          label="Team-Kund:innen"
          value={formatNumber(teamKunden)}
          hint="aktiver Bestand der Downline"
          accent="sky"
          icon={IconUsers}
        />
        <StatCard
          label="Team-Bestand"
          value={`${formatEur(teamBestand)}/M`}
          hint="MRR der direkten Linie"
          accent="success"
          icon={IconEuro}
        />
        <StatCard
          label="Override-Status"
          value={earnings.override_pausiert > 0 ? "Pausiert" : "Aktiv"}
          hint={`${formatNumber(override.active_direct_count)}/${formatNumber(
            override.min_active_directs
          )} aktive Direkte`}
          accent={earnings.override_pausiert > 0 ? "warning" : "success"}
          icon={IconNetwork}
        />
      </div>

      <OverrideNudge earnings={earnings} override={override} />

      <TeamDownline team={downline} />
    </div>
  );
}
