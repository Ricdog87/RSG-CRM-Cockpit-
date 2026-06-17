import { getAccounts } from "@/lib/crm-data";
import { createAccount } from "@/lib/crm-actions";
import { autofillAccountAction } from "@/lib/ai-actions";
import { PageHeader } from "@/components/cockpit/PageHeader";
import { AccountsView } from "@/components/cockpit/views/AccountsView";
import { BackfillAccountsButton } from "@/components/cockpit/BackfillAccountsButton";
import { EntityFormDialog } from "@/components/cockpit/EntityFormDialog";
import { StatCard } from "@/components/cockpit/StatCard";
import { ACCOUNT_FIELDS } from "@/lib/crm-forms";
import { IconUsers, IconEuro, IconPhone, IconBriefcase } from "@/components/ui/icons";
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
  const derivedCount = accounts.filter((a) => a.synthetic).length;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Customer Management"
        title="Kunden"
        description="Alle Unternehmen, Kontakte und ihr Lifecycle – über beide Geschäftslinien."
        action={
          <EntityFormDialog
            triggerLabel="Account anlegen"
            title="Neuen Account anlegen"
            description="Unternehmen mit Kontakt und Geschäftslinie erfassen."
            fields={ACCOUNT_FIELDS}
            action={createAccount}
            autofill={autofillAccountAction}
            autofillFrom={["name", "contact_email"]}
            autoOpenParam="new"
          />
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          label="Accounts"
          value={formatNumber(accounts.length)}
          hint={`${formatNumber(kunden.length)} aktive Kund:innen`}
          accent="sky"
          icon={IconUsers}
        />
        <StatCard
          label="KI-Linie"
          value={formatNumber(ki.length)}
          hint="Telefonassistenz & Automatisierung"
          accent="sky"
          icon={IconPhone}
        />
        <StatCard
          label="Recruiting-Linie"
          value={formatNumber(recruiting.length)}
          hint="Personalvermittlung"
          accent="brand"
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

      <BackfillAccountsButton derivedCount={derivedCount} />

      <AccountsView accounts={accounts} />
    </div>
  );
}
