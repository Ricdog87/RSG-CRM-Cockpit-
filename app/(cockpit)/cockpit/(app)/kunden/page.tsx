import { getAccounts } from "@/lib/crm-data";
import { createAccount } from "@/lib/crm-actions";
import { PageHeader } from "@/components/cockpit/PageHeader";
import { AccountsView } from "@/components/cockpit/views/AccountsView";
import { EntityFormDialog, type FormField } from "@/components/cockpit/EntityFormDialog";
import { StatCard } from "@/components/cockpit/StatCard";
import { IconUsers, IconEuro, IconPhone, IconBriefcase } from "@/components/ui/icons";
import { formatEur, formatNumber } from "@/lib/format";

export const dynamic = "force-dynamic";

const FIELDS: FormField[] = [
  { name: "name", label: "Unternehmen", required: true, full: true, placeholder: "Muster GmbH" },
  {
    name: "line",
    label: "Geschäftslinie",
    type: "select",
    options: [
      { value: "ki", label: "KI & Telefonassistenz" },
      { value: "recruiting", label: "Personalvermittlung" },
    ],
  },
  {
    name: "lifecycle",
    label: "Phase",
    type: "select",
    options: [
      { value: "lead", label: "Lead" },
      { value: "opportunity", label: "Opportunity" },
      { value: "kunde", label: "Kunde" },
      { value: "bestand", label: "Bestand" },
    ],
  },
  { name: "branche", label: "Branche", placeholder: "z.B. Gesundheit" },
  { name: "segment", label: "Segment", placeholder: "z.B. Praxen" },
  { name: "ort", label: "Ort" },
  { name: "contact_name", label: "Ansprechpartner:in" },
  { name: "contact_email", label: "E-Mail", type: "email" },
  { name: "mrr", label: "MRR (€)", type: "number", placeholder: "0" },
];

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
          <EntityFormDialog
            triggerLabel="Account anlegen"
            title="Neuen Account anlegen"
            description="Unternehmen mit Kontakt und Geschäftslinie erfassen."
            fields={FIELDS}
            action={createAccount}
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

      <AccountsView accounts={accounts} />
    </div>
  );
}
