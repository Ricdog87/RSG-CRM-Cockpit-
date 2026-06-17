import { getOpportunities, getMandates, getCandidates, getKiProjects } from "@/lib/crm-data";
import { getPlacements } from "@/lib/placements-data";
import { mandateRevenue } from "@/lib/crm-types";
import { PageHeader } from "@/components/cockpit/PageHeader";
import { StatCard } from "@/components/cockpit/StatCard";
import { Card, CardBody, SectionHeader } from "@/components/ui/Card";
import { FunnelChart, ForecastChart } from "@/components/cockpit/BerichteCharts";
import { SourceRoiTable, type SourceRoiRow } from "@/components/cockpit/SourceRoiTable";
import { IconTarget, IconEuro, IconTrendingUp, IconBriefcase, IconUserCheck, IconClock } from "@/components/ui/icons";
import { formatEur, formatNumber, formatPercent } from "@/lib/format";
import type { CandidateStage } from "@/lib/crm-types";

export const dynamic = "force-dynamic";

const STAGES: { key: string; label: string }[] = [
  { key: "neu", label: "Neu" },
  { key: "qualifiziert", label: "Qualifiziert" },
  { key: "demo", label: "Demo/Termin" },
  { key: "angebot", label: "Angebot" },
  { key: "verhandlung", label: "Verhandlung" },
  { key: "gewonnen", label: "Gewonnen" },
];

const MONTHS = ["Jan", "Feb", "Mär", "Apr", "Mai", "Jun", "Jul", "Aug", "Sep", "Okt", "Nov", "Dez"];

const RECRUIT_FUNNEL: { key: CandidateStage; label: string }[] = [
  { key: "neu", label: "Neu" },
  { key: "screening", label: "Screening" },
  { key: "interview", label: "Interview" },
  { key: "angebot", label: "Angebot" },
  { key: "platziert", label: "Platziert" },
];

export default async function BerichtePage() {
  const [opps, mandates, candidates, placements, kiProjects] = await Promise.all([
    getOpportunities(),
    getMandates(),
    getCandidates(),
    getPlacements(),
    getKiProjects(),
  ]);

  const open = opps.filter((o) => o.stage !== "gewonnen" && o.stage !== "verloren");
  const won = opps.filter((o) => o.stage === "gewonnen").length;
  const lost = opps.filter((o) => o.stage === "verloren").length;
  const weighted = open.reduce((s, o) => s + (o.value * o.probability) / 100, 0);
  const avgDeal = open.length ? open.reduce((s, o) => s + o.value, 0) / open.length : 0;
  const winRate = won + lost > 0 ? (won / (won + lost)) * 100 : 0;

  // Funnel: Anzahl je Phase.
  const funnel = STAGES.map(({ key, label }) => ({
    stage: label,
    count: opps.filter((o) => o.stage === key).length,
  }));

  // Forecast: gewichtetes Volumen je erwartetem Abschlussmonat.
  const byMonth = new Map<string, number>();
  for (const o of open) {
    if (!o.expected_close) continue;
    const d = new Date(o.expected_close);
    if (Number.isNaN(d.getTime())) continue;
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    byMonth.set(key, (byMonth.get(key) ?? 0) + (o.value * o.probability) / 100);
  }
  const forecast = Array.from(byMonth.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .slice(0, 8)
    .map(([key, value]) => ({
      month: MONTHS[Number(key.slice(5, 7)) - 1],
      value: Math.round(value),
    }));

  const openPositions = mandates.reduce((s, m) => s + Math.max(0, m.positions - m.filled), 0);
  const filled = mandates.reduce((s, m) => s + m.filled, 0);
  const totalPositions = mandates.reduce((s, m) => s + m.positions, 0);
  const fillRate = totalPositions > 0 ? (filled / totalPositions) * 100 : 0;

  // ---- Recruiting-KPIs --------------------------------------------------
  const active = candidates.filter((c) => c.stage !== "abgelehnt");
  const recruitFunnel = RECRUIT_FUNNEL.map(({ key, label }) => ({
    stage: label,
    count: active.filter((c) => c.stage === key).length,
  }));

  const placedCount = placements.length;
  const placedFee = placements.reduce((s, p) => s + (p.agreed_fee ?? 0), 0);
  const submittedToPlaced = active.length > 0 ? (placedCount / active.length) * 100 : 0;

  // Time-to-Fill: Tage von Mandat-Anlage bis Eintritt der ersten Platzierung.
  const mandateById = new Map(mandates.map((m) => [m.id, m]));
  const ttfDays: number[] = [];
  for (const p of placements) {
    const m = p.mandate_id ? mandateById.get(p.mandate_id) : undefined;
    if (m?.created_at && p.start_date) {
      const a = new Date(m.created_at).getTime();
      const b = new Date(p.start_date + "T00:00:00").getTime();
      if (!Number.isNaN(a) && !Number.isNaN(b) && b >= a) ttfDays.push(Math.round((b - a) / 86400000));
    }
  }
  const timeToFill = ttfDays.length ? Math.round(ttfDays.reduce((s, d) => s + d, 0) / ttfDays.length) : 0;

  // Quellen-ROI: Kandidaten je Quelle vs. Platzierungen + Honorar.
  const candById = new Map(candidates.map((c) => [c.id, c]));
  const sourceMap = new Map<string, SourceRoiRow>();
  for (const c of candidates) {
    const key = c.source?.trim() || "Unbekannt";
    const row = sourceMap.get(key) ?? { source: key, candidates: 0, placed: 0, fee: 0 };
    row.candidates += 1;
    sourceMap.set(key, row);
  }
  for (const p of placements) {
    const c = p.candidate_id ? candById.get(p.candidate_id) : undefined;
    const key = c?.source?.trim() || "Unbekannt";
    const row = sourceMap.get(key) ?? { source: key, candidates: 0, placed: 0, fee: 0 };
    row.placed += 1;
    row.fee += p.agreed_fee ?? 0;
    sourceMap.set(key, row);
  }
  const sourceRows = Array.from(sourceMap.values()).sort((a, b) => b.placed - a.placed || b.candidates - a.candidates);

  // ---- Pipeline / Forecast aus Angeboten ------------------------------
  const recruitOffers = mandates.filter((m) => m.status === "angebot");
  const kiOffers = kiProjects.filter((p) => p.status === "angebot");
  const recruitForecast = recruitOffers.reduce((s, m) => s + mandateRevenue(m), 0);
  const kiForecastMrr = kiOffers.reduce((s, p) => s + p.mrr, 0);
  const kiForecastArr = kiForecastMrr * 12;
  const gesamtPipeline = recruitForecast + kiForecastArr;

  // Monats-Prognose: erwarteter Eingang je Monat (Recruiting-Honorar nach
  // Deadline-Monat, KI Setup + 1. MRR nach Go-Live-Monat).
  const fMonth = new Map<string, number>();
  const addF = (iso: string | undefined, value: number) => {
    if (value <= 0) return;
    const d = iso ? new Date(iso) : new Date();
    const key = Number.isNaN(d.getTime())
      ? new Date().toISOString().slice(0, 7)
      : `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    fMonth.set(key, (fMonth.get(key) ?? 0) + value);
  };
  for (const m of recruitOffers) addF(m.deadline, mandateRevenue(m));
  for (const p of kiOffers) addF(p.go_live, (p.setup_fee ?? 0) + p.mrr);
  const forecastByMonth = Array.from(fMonth.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .slice(0, 8)
    .map(([key, value]) => ({ month: MONTHS[Number(key.slice(5, 7)) - 1], value: Math.round(value) }));

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Analytics"
        title="Berichte"
        description="Pipeline-Funnel, Forecast und Vertriebskennzahlen auf einen Blick."
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          label="Offene Chancen"
          value={`${open.length}`}
          hint={`${formatEur(weighted)} gewichtet`}
          accent="sky"
          icon={IconTarget}
        />
        <StatCard
          label="Ø Dealgröße"
          value={formatEur(avgDeal)}
          hint="offene Chancen"
          accent="brand"
          icon={IconEuro}
        />
        <StatCard
          label="Win-Rate"
          value={formatPercent(winRate)}
          hint={`${won} gewonnen · ${lost} verloren`}
          accent="success"
          icon={IconTrendingUp}
        />
        <StatCard
          label="Besetzungsquote"
          value={formatPercent(fillRate)}
          hint={`${openPositions} Stellen offen`}
          accent="warning"
          icon={IconBriefcase}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardBody>
            <SectionHeader title="Pipeline-Funnel" hint="Anzahl Chancen je Phase" />
            <FunnelChart data={funnel} />
          </CardBody>
        </Card>
        <Card>
          <CardBody>
            <SectionHeader
              title="Forecast"
              hint="gewichtetes Volumen je erwartetem Abschluss"
            />
            {forecast.length > 0 ? (
              <ForecastChart data={forecast} />
            ) : (
              <p className="py-12 text-center text-sm text-faint">
                Noch keine datierten Abschlüsse für einen Forecast.
              </p>
            )}
          </CardBody>
        </Card>
      </div>

      {/* Recruiting-KPIs */}
      <div className="pt-2">
        <SectionHeader title="Recruiting" hint="Funnel, Time-to-Fill & Quellen-ROI" />
      </div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          label="Platzierungen"
          value={formatNumber(placedCount)}
          hint={`${formatEur(placedFee)} Honorar`}
          accent="success"
          icon={IconUserCheck}
        />
        <StatCard
          label="Kandidat→Platzierung"
          value={formatPercent(submittedToPlaced)}
          hint={`${active.length} aktive Kandidat:innen`}
          accent="brand"
          icon={IconTrendingUp}
        />
        <StatCard
          label="Time-to-Fill"
          value={timeToFill > 0 ? `${timeToFill} T` : "—"}
          hint="Mandat-Anlage → Eintritt"
          accent="sky"
          icon={IconClock}
        />
        <StatCard
          label="Besetzungsquote"
          value={formatPercent(fillRate)}
          hint={`${filled} / ${totalPositions} Stellen`}
          accent="warning"
          icon={IconBriefcase}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardBody>
            <SectionHeader title="Kandidaten-Funnel" hint="aktive Kandidat:innen je Phase" />
            <FunnelChart data={recruitFunnel} />
          </CardBody>
        </Card>
        <Card>
          <CardBody>
            <SectionHeader title="Quellen-ROI" hint="Kanäle → Platzierungen & Honorar" />
            <SourceRoiTable rows={sourceRows} />
          </CardBody>
        </Card>
      </div>

      {/* Pipeline / Forecast aus Angeboten */}
      <div className="pt-2">
        <SectionHeader title="Pipeline & Forecast" hint="aus Angeboten beider Geschäftslinien" />
      </div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Gesamt-Pipeline" value={formatEur(gesamtPipeline)} hint="Recruiting + KI (ARR)" accent="brand" icon={IconTrendingUp} />
        <StatCard label="Recruiting-Angebote" value={formatEur(recruitForecast)} hint={`${formatNumber(recruitOffers.length)} Mandate`} accent="sky" icon={IconBriefcase} />
        <StatCard label="KI-Angebote (MRR)" value={`${formatEur(kiForecastMrr)}/M`} hint={`${formatEur(kiForecastArr)} ARR`} accent="success" icon={IconEuro} />
        <StatCard label="KI-Angebote (Anzahl)" value={formatNumber(kiOffers.length)} hint="in Planung/Angebot" accent="neutral" icon={IconTarget} />
      </div>
      <Card>
        <CardBody>
          <SectionHeader title="Monats-Prognose" hint="erwarteter Eingang je Monat (Honorar + Setup + 1. MRR)" />
          {forecastByMonth.length > 0 ? (
            <ForecastChart data={forecastByMonth} />
          ) : (
            <p className="py-12 text-center text-sm text-faint">
              Noch keine Angebote mit Datum. Setze Mandate/KI-Projekte auf „Angebot / Planung“ und hinterlege Deadline bzw. Go-Live.
            </p>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
