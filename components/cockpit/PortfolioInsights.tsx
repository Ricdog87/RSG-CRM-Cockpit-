import { Card, CardBody } from "@/components/ui/Card";
import { IconSpark } from "@/components/ui/icons";
import { cn } from "@/components/ui/cn";

export interface Insight {
  label: string;
  value: string;
  note: string;
  tone: "brand" | "sky" | "success" | "warning" | "danger";
}

const toneRing: Record<Insight["tone"], string> = {
  brand: "border-brand/30",
  sky: "border-sky/30",
  success: "border-success/30",
  warning: "border-warning/30",
  danger: "border-danger/30",
};
const toneText: Record<Insight["tone"], string> = {
  brand: "text-brand-deep",
  sky: "text-sky-deep",
  success: "text-success",
  warning: "text-warning",
  danger: "text-danger",
};

/** Portfolio-Intelligenz: computed „so what“-Erkenntnisse auf einen Blick. */
export function PortfolioInsights({ insights }: { insights: Insight[] }) {
  if (insights.length === 0) return null;
  return (
    <Card className="border-brand/20 bg-gradient-to-br from-surface to-brand/[0.03]">
      <CardBody className="space-y-3">
        <div className="flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand/10 text-brand-deep">
            <IconSpark size={15} />
          </span>
          <p className="font-semibold text-ink">Portfolio-Insights</p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {insights.map((it, i) => (
            <div key={i} className={cn("rounded-xl border bg-surface p-3", toneRing[it.tone])}>
              <p className="kpi-label">{it.label}</p>
              <p className={cn("mt-1 text-xl font-black tracking-tight", toneText[it.tone])}>{it.value}</p>
              <p className="mt-1 text-xs text-muted">{it.note}</p>
            </div>
          ))}
        </div>
      </CardBody>
    </Card>
  );
}
