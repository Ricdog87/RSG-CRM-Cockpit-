import { getCockpitData } from "@/lib/data";
import { PageHeader } from "@/components/cockpit/PageHeader";
import { CustomersTable } from "@/components/cockpit/CustomersTable";
import { StatCard } from "@/components/cockpit/StatCard";
import { IconUsers, IconEuro, IconSpark } from "@/components/ui/icons";
import { formatEur, formatNumber } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function KundenPage() {
  const { customers } = await getCockpitData();

  const aktiv = customers.filter((c) => c.status === "aktiv");
  const onboarding = customers.filter((c) => c.status === "onboarding");
  const mrrSum = aktiv.reduce((s, c) => s + c.mrr, 0);
  const provSum = aktiv.reduce((s, c) => s + c.bestandsprovision, 0);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Bestand"
        title="Kunden"
        description="Dein aktiver wiederkehrender Bestand, Onboarding und Stornoreserve."
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          label="Aktive Kund:innen"
          value={formatNumber(aktiv.length)}
          hint={`${formatNumber(onboarding.length)} im Onboarding`}
          accent="cyan"
          icon={IconUsers}
        />
        <StatCard
          label="MRR-Volumen"
          value={`${formatEur(mrrSum)}/M`}
          hint="aktiver Kundenumsatz"
          accent="purple"
          icon={IconEuro}
        />
        <StatCard
          label="Bestandsprovision"
          value={`${formatEur(provSum)}/M`}
          hint="17 % MRR (Provisionsordnung §3.1)"
          accent="success"
          icon={IconSpark}
        />
        <StatCard
          label="Ø Provision / Kunde"
          value={aktiv.length ? formatEur(provSum / aktiv.length) : "–"}
          hint="pro aktiver Kund:in"
          accent="neutral"
          icon={IconEuro}
        />
      </div>

      <CustomersTable customers={customers} />
    </div>
  );
}
