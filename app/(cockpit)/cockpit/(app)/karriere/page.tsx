import { getCockpitData } from "@/lib/data";
import { PageHeader } from "@/components/cockpit/PageHeader";
import { CareerLadder } from "@/components/cockpit/CareerLadder";
import { CareerProgress } from "@/components/cockpit/CareerProgress";
import { Leaderboard } from "@/components/cockpit/Leaderboard";

export const dynamic = "force-dynamic";

export default async function KarrierePage() {
  const { career, leaderboard } = await getCockpitData();

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Entwicklung"
        title="Karriere"
        description="Dein Stand im RSG-Stufenplan, freigeschaltete Override-Ebenen und das Leaderboard."
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <CareerLadder currentLevel={career.current.level} />
        <div className="space-y-6">
          <CareerProgress career={career} />
          <Leaderboard rows={leaderboard} />
        </div>
      </div>
    </div>
  );
}
