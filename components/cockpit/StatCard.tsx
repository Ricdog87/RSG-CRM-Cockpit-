import { Card, CardBody } from "@/components/ui/Card";
import { cn } from "@/components/ui/cn";

type Accent = "purple" | "cyan" | "warning" | "success" | "neutral";

const accentDot: Record<Accent, string> = {
  purple: "bg-purple",
  cyan: "bg-cyan",
  warning: "bg-warning",
  success: "bg-success",
  neutral: "bg-faint",
};

const accentIcon: Record<Accent, string> = {
  purple: "bg-purple/10 text-purple-deep",
  cyan: "bg-cyan/10 text-cyan-deep",
  warning: "bg-warning/10 text-warning",
  success: "bg-success/10 text-success",
  neutral: "bg-elevated text-muted",
};

/** Kompakte Kennzahl-Karte mit optionalem Icon. */
export function StatCard({
  label,
  value,
  hint,
  accent = "neutral",
  icon,
}: {
  label: string;
  value: string;
  hint?: string;
  accent?: Accent;
  icon?: (p: { size?: number; className?: string }) => JSX.Element;
}) {
  const Icon = icon;
  return (
    <Card className="card-hover">
      <CardBody className="space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className={cn("h-1.5 w-1.5 rounded-full", accentDot[accent])} />
            <p className="kpi-label">{label}</p>
          </div>
          {Icon ? (
            <span
              className={cn(
                "flex h-8 w-8 items-center justify-center rounded-lg",
                accentIcon[accent]
              )}
            >
              <Icon size={16} />
            </span>
          ) : null}
        </div>
        <p className="text-2xl font-bold tracking-tight text-ink">{value}</p>
        {hint ? <p className="text-xs text-muted">{hint}</p> : null}
      </CardBody>
    </Card>
  );
}
