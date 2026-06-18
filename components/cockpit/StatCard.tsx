import Link from "next/link";
import { Card, CardBody } from "@/components/ui/Card";
import { cn } from "@/components/ui/cn";

type Accent = "brand" | "sky" | "warning" | "success" | "neutral";

const accentDot: Record<Accent, string> = {
  brand: "bg-brand",
  sky: "bg-sky",
  warning: "bg-warning",
  success: "bg-success",
  neutral: "bg-faint",
};

const accentIcon: Record<Accent, string> = {
  brand: "bg-brand/10 text-brand-deep",
  sky: "bg-sky/10 text-sky-deep",
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
  href,
}: {
  label: string;
  value: string;
  hint?: string;
  accent?: Accent;
  icon?: (p: { size?: number; className?: string }) => JSX.Element;
  /** Optional: macht die Karte klickbar (Drill-down). */
  href?: string;
}) {
  const Icon = icon;
  return (
    <Card className={cn("card-hover", href && "transition-colors hover:border-brand/40")}>
      <CardBody className={cn("space-y-2", href && "relative")}>
        {href ? (
          <Link href={href} className="absolute inset-0 z-10" aria-label={label} />
        ) : null}
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
