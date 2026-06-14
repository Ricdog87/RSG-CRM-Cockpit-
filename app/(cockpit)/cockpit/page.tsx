import { getCockpitData } from "@/lib/data";
import { CockpitHeader } from "@/components/cockpit/CockpitHeader";
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
    <main className="mx-auto max-w-5xl space-y-6 px-4 py-6 sm:px-6 sm:py-8">
      <div className="animate-fade-up">
        <CockpitHeader name={data.partner.display_name} />
      </div>

      {/* 1. Hero: wiederkehrender Bestand + Wachstumskurve */}
      <section className="animate-fade-up" aria-label="Wiederkehrender Bestand">
        <HeroBestand bestand={data.bestand} verlauf={data.bestandsverlauf} />
      </section>

      {/* 2. KPI-Reihe */}
      <section className="animate-fade-up" aria-label="Kennzahlen">
        <KpiRow bestand={data.bestand} earnings={data.earnings} />
      </section>

      {/* 3. Override-Nudge (nur wenn override_pausiert > 0) */}
      <section className="animate-fade-up" aria-label="Override-Hinweis">
        <OverrideNudge earnings={data.earnings} override={data.override} />
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* 4. Pipeline */}
        <section className="animate-fade-up" aria-label="Pipeline">
          <Pipeline deals={data.pipeline} />
        </section>

        {/* 5. Karriere */}
        <section className="animate-fade-up" aria-label="Karriere">
          <CareerProgress career={data.career} />
        </section>

        {/* 6. Leaderboard */}
        <section className="animate-fade-up" aria-label="Leaderboard">
          <Leaderboard rows={data.leaderboard} />
        </section>

        {/* 7. Team/Downline */}
        <section className="animate-fade-up" aria-label="Team">
          <TeamDownline team={data.downline} />
        </section>
      </div>

      <footer className="pt-2 text-center text-xs text-faint">
        RSG Partner-Cockpit · Bestand, Provisionen & Team in Echtzeit
      </footer>
    </main>
  );
}
