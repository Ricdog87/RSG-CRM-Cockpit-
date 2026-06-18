import { Card, CardBody } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { IconChevronRight, IconCheck, IconAlertTriangle, IconSpark } from "@/components/ui/icons";
import { cn } from "@/components/ui/cn";
import { NextActionButton } from "@/components/cockpit/NextActionButton";
import type { MandateIntel, MandateIntelTone } from "@/lib/mandate-intel";

const badgeTone: Record<MandateIntelTone, "success" | "sky" | "warning" | "danger"> = {
  success: "success",
  sky: "sky",
  warning: "warning",
  danger: "danger",
};

/** Mandats-Empfehlung: nächste beste Aktion für Recruiter:innen. */
export function MandateIntelCard({
  intel,
  accountId,
  accountName,
}: {
  intel: MandateIntel;
  accountId?: string;
  accountName?: string;
}) {
  return (
    <Card className="border-brand/25 bg-gradient-to-br from-brand/[0.05] to-surface">
      <CardBody className="space-y-3">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 flex h-9 w-9 flex-none items-center justify-center rounded-xl bg-brand/10 text-brand-deep">
            <IconSpark size={18} />
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <p className="font-semibold text-ink">Mandats-Intelligenz</p>
              <Badge tone={badgeTone[intel.tone]}>{intel.label}</Badge>
            </div>
            <p className="mt-1 flex items-start gap-1.5 text-sm text-brand-deep">
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
