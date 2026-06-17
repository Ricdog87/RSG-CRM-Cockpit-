import { getAccounts, getMandates, getKiProjects, getOpportunities, getCandidates, accountKey } from "@/lib/crm-data";
import { computeAccountIntel } from "@/lib/account-intel";
import { findAccountDuplicates } from "@/lib/account-dedupe";
import { AccountDuplicates } from "@/components/cockpit/AccountDuplicates";
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
  const [accounts, mandates, kiProjects, opportunities, candidates] = await Promise.all([
    getAccounts(),
    getMandates(),
    getKiProjects(),
    getOpportunities(),
    getCandidates(),
  ]);

  // Health-Score je Account aus den (einmalig geladenen) verknüpften Daten.
  const group = <T,>(items: T[], keyFn: (t: T) => string) => {
    const m = new Map<string, T[]>();
    for (const it of items) {
      const k = accountKey(keyFn(it));
      const arr = m.get(k);
      if (arr) arr.push(it);
      else m.set(k, [it]);
    }
    return m;
  };
  const mByName = group(mandates, (m) => m.account_name);
  const kByName = group(kiProjects, (p) => p.account_name);
  const oByName = group(opportunities, (o) => o.account_name);
  const cByName = group(candidates, (c) => c.mandate_account);
  const healthById: Record<string, { score: number; tone: string; label: string }> = {};
  for (const a of accounts) {
    const k = accountKey(a.name);
    const intel = computeAccountIntel({
      account: a,
      opportunities: oByName.get(k) ?? [],
      kiProjects: kByName.get(k) ?? [],
      mandates: mByName.get(k) ?? [],
      candidates: cByName.get(k) ?? [],
    });
    healthById[a.id] = { score: intel.score, tone: intel.tone, label: intel.label };
  }

  const ki = accounts.filter((a) => a.line === "ki");
  const recruiting = accounts.filter((a) => a.line === "recruiting");
  const mrrSum = accounts.reduce((s, a) => s + a.mrr, 0);
  const kunden = accounts.filter(
    (a) => a.lifecycle === "kunde" || a.lifecycle === "bestand"
  );
  const derivedCount = accounts.filter((a) => a.synthetic).length;
  const duplicateGroups = findAccountDuplicates(accounts);

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

      <AccountDuplicates groups={duplicateGroups} />

      <AccountsView accounts={accounts} healthById={healthById} />
    </div>
  );
}
