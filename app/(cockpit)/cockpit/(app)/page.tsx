import { getCockpitData } from "@/lib/data";
import { HeroBestand } from "@/components/cockpit/HeroBestand";
import { KpiRow } from "@/components/cockpit/KpiRow";
import { OverrideNudge } from "@/components/cockpit/OverrideNudge";
import { Pipeline } from "@/components/cockpit/Pipeline";
import { CareerProgress } from "@/components/cockpit/CareerProgress";
import { Leaderboard } from "@/components/cockpit/Leaderboard";
import { TeamDownline } from "@/components/cockpit/TeamDownline";

// Immer frisch rendern – Daten sind nutzer- und sessionspezifisch.
export const dynamic = "force-dynamic";

export default async function CockpitPage() {
  const data = await getCockpitData();

  return (
    <div className="space-y-6">
      {/* 1. Hero: wiederkehrender Bestand + Wachstumskurve */}
      <section className="animate-fade-up" aria-label="Wiederkehrender Bestand">
        <HeroBestand bestand={data.bestand} verlauf={data.bestandsverlauf} />
      </section>

      {/* 2. KPI-Reihe */}
      <section className="animate-fade-up" aria-label="Kennzahlen">
        <KpiRow
          bestand={data.bestand}
          earnings={data.earnings}
          provisionAktuellerMonat={data.provisionAktuellerMonat}
        />
      </section>

      {/* 3. Override-Nudge (nur wenn override_pausiert > 0) */}
      <OverrideNudge earnings={data.earnings} override={data.override} />

      <div className="grid gap-6 lg:grid-cols-2">
        {/* 4. Pipeline-Vorschau */}
        <section className="animate-fade-up" aria-label="Pipeline">
          <Pipeline deals={data.pipeline} limit={4} viewAllHref="/cockpit/pipeline" />
        </section>

        {/* 5. Karriere */}
        <section className="animate-fade-up" aria-label="Karriere">
          <CareerProgress career={data.career} />
        </section>

        {/* 6. Leaderboard */}
        <section className="animate-fade-up" aria-label="Leaderboard">
          <Leaderboard rows={data.leaderboard} />
        </section>

        {/* 7. Team/Downline-Vorschau */}
        <section className="animate-fade-up" aria-label="Team">
          <TeamDownline team={data.downline} limit={3} viewAllHref="/cockpit/team" />
        </section>
      </div>
    </div>
  );
}
