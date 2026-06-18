import { Card, CardBody } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { IconChevronRight, IconCheck, IconAlertTriangle, IconSpark } from "@/components/ui/icons";
import { cn } from "@/components/ui/cn";
import { NextActionButton } from "@/components/cockpit/NextActionButton";
import type { KiProjectIntel, KiIntelTone } from "@/lib/ki-intel";

const badgeTone: Record<KiIntelTone, "success" | "sky" | "warning" | "danger"> = {
  success: "success",
  sky: "sky",
  warning: "warning",
  danger: "danger",
};

/** KI-Projekt-Empfehlung: nächste beste Aktion für die KI-Berater:innen. */
export function KiProjectIntelCard({
  intel,
  accountId,
  accountName,
}: {
  intel: KiProjectIntel;
  accountId?: string;
  accountName?: string;
}) {
  return (
    <Card className="border-sky/25 bg-gradient-to-br from-sky/[0.05] to-surface">
      <CardBody className="space-y-3">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 flex h-9 w-9 flex-none items-center justify-center rounded-xl bg-sky/10 text-sky-deep">
            <IconSpark size={18} />
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <p className="font-semibold text-ink">Projekt-Intelligenz</p>
              <Badge tone={badgeTone[intel.tone]}>{intel.label}</Badge>
            </div>
            <p className="mt-1 flex items-start gap-1.5 text-sm text-sky-deep">
              <IconChevronRight size={14} className="mt-0.5 flex-none" />
              <span className="font-medium">{intel.recommendation}</span>
            </p>
            {accountId && accountName ? (
              <div className="mt-2">
                <NextActionButton accountId={accountId} accountName={accountName} action={intel.recommendation} />
              </div>
            ) : null}
          </div>
        </div>

        {intel.factors.length > 0 ? (
          <div className="flex flex-wrap gap-1.5">
            {intel.factors.map((f, i) => (
              <span
                key={i}
                className={cn(
                  "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[0.7rem]",
                  f.positive
                    ? "border-success/30 bg-success/[0.06] text-success"
                    : "border-warning/30 bg-warning/[0.06] text-warning"
                )}
              >
                {f.positive ? <IconCheck size={11} /> : <IconAlertTriangle size={11} />}
                {f.label}
              </span>
            ))}
          </div>
        ) : null}
      </CardBody>
    </Card>
  );
}
