import { getAccounts } from "@/lib/crm-data";
import { PageHeader } from "@/components/cockpit/PageHeader";
import { AccountsTable } from "@/components/cockpit/AccountsTable";
import { StatCard } from "@/components/cockpit/StatCard";
import { Button } from "@/components/ui/Button";
import { IconUsers, IconEuro, IconPhone, IconBriefcase, IconPlus } from "@/components/ui/icons";
import { formatEur, formatNumber } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function KundenPage() {
  const accounts = await getAccounts();

  const ki = accounts.filter((a) => a.line === "ki");
  const recruiting = accounts.filter((a) => a.line === "recruiting");
  const mrrSum = accounts.reduce((s, a) => s + a.mrr, 0);
  const kunden = accounts.filter(
    (a) => a.lifecycle === "kunde" || a.lifecycle === "bestand"
  );

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Customer Management"
        title="Kunden"
        description="Alle Unternehmen, Kontakte und ihr Lifecycle – über beide Geschäftslinien."
        action={
          <Button>
            <IconPlus size={16} /> Account anlegen
          </Button>
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          label="Accounts"
          value={formatNumber(accounts.length)}
          hint={`${formatNumber(kunden.length)} aktive Kund:innen`}
          accent="cyan"
          icon={IconUsers}
        />
        <StatCard
          label="KI-Linie"
          value={formatNumber(ki.length)}
          hint="Telefonassistenz & Automatisierung"
          accent="cyan"
          icon={IconPhone}
        />
        <StatCard
          label="Recruiting-Linie"
          value={formatNumber(recruiting.length)}
          hint="Personalvermittlung"
          accent="purple"
          icon={IconBriefcase}
        />
        <StatCard
          label="MRR gesamt"
          value={`${formatEur(mrrSum)}/M`}
          hint="wiederkehrender KI-Umsatz"
          accent="success"
          icon={IconEuro}
        />
      </div>

      <AccountsTable accounts={accounts} />
    </div>
  );
}
