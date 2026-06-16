import { Card, CardBody, SectionHeader } from "@/components/ui/Card";
import { formatEur } from "@/lib/format";
import type { KiProject, RecruitingMandate } from "@/lib/crm-types";

function currentYm(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/**
 * Einmalumsatz-Kachel fürs Dashboard: einmalige Implementierungskosten (KI)
 * und Anzahlungen (Recruiting) – „dieses Monats" plus offenes Gesamtvolumen.
 */
export function OneTimeRevenue({
  kiProjects,
  mandates,
}: {
  kiProjects: KiProject[];
  mandates: RecruitingMandate[];
}) {
  const ym = currentYm();

  // KI: Implementierung von Projekten mit Go-Live in diesem Monat.
  const kiThisMonth = kiProjects
    .filter((p) => p.status !== "gekuendigt" && (p.go_live ?? "").startsWith(ym))
    .reduce((s, p) => s + (p.setup_fee ?? 0), 0);

  // Offenes Einmalvolumen gesamt: KI-Setup aktiver Projekte + Recruiting-Anzahlungen
  // noch offener Stellen.
  const kiOpenSetup = kiProjects
    .filter((p) => p.status !== "gekuendigt")
    .reduce((s, p) => s + (p.setup_fee ?? 0), 0);
  const depositsOpen = mandates.reduce(
    (s, m) => s + Math.max(0, m.positions - m.filled) * (m.deposit ?? 0),
    0
  );
  const openTotal = kiOpenSetup + depositsOpen;

  return (
    <Card>
      <CardBody>
        <SectionHeader title="Einmalumsatz" hint="Implementierung & Anzahlungen" />
        <p className="text-3xl font-black tracking-tight text-ink">{formatEur(kiThisMonth)}</p>
        <p className="text-xs text-muted">KI-Implementierung mit Go-Live diesen Monat</p>

        <dl className="mt-4 space-y-2 border-t border-border/60 pt-3 text-xs">
          <div className="flex items-center justify-between gap-2">
            <dt className="text-faint">KI-Setup offen (aktiv)</dt>
            <dd className="font-medium text-ink">{formatEur(kiOpenSetup)}</dd>
          </div>
          <div className="flex items-center justify-between gap-2">
            <dt className="text-faint">Recruiting-Anzahlungen offen</dt>
            <dd className="font-medium text-ink">{formatEur(depositsOpen)}</dd>
          </div>
          <div className="flex items-center justify-between gap-2 border-t border-border/60 pt-2">
            <dt className="font-semibold text-muted">Offenes Einmalvolumen</dt>
            <dd className="font-bold text-brand-deep">{formatEur(openTotal)}</dd>
          </div>
        </dl>
      </CardBody>
    </Card>
  );
}
