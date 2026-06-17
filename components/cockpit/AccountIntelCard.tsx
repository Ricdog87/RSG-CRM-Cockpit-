import { Card, CardBody } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { IconChevronRight, IconCheck, IconAlertTriangle } from "@/components/ui/icons";
import { cn } from "@/components/ui/cn";
import type { AccountIntel, IntelTone } from "@/lib/account-intel";

const ringTone: Record<IntelTone, string> = {
  success: "text-success",
  sky: "text-sky-deep",
  warning: "text-warning",
  danger: "text-danger",
};
const badgeTone: Record<IntelTone, "success" | "sky" | "warning" | "danger"> = {
  success: "success",
  sky: "sky",
  warning: "warning",
  danger: "danger",
};

/** Account-Health-Score (0–100) mit Faktoren und nächster bester Aktion. */
export function AccountIntelCard({ intel }: { intel: AccountIntel }) {
  const circumference = 2 * Math.PI * 26;
  const dash = (intel.score / 100) * circumference;

  return (
    <Card className="border-brand/20 bg-gradient-to-br from-surface to-brand/[0.03]">
      <CardBody className="space-y-4">
        <div className="flex items-center gap-4">
          {/* Score-Ring */}
          <div className="relative flex-none">
            <svg width="64" height="64" viewBox="0 0 64 64" className="-rotate-90">
              <circle cx="32" cy="32" r="26" fill="none" strokeWidth="6" className="stroke-elevated" />
              <circle
                cx="32"
                cy="32"
                r="26"
                fill="none"
                strokeWidth="6"
                strokeLinecap="round"
                strokeDasharray={`${dash} ${circumference}`}
                className={cn("transition-all", ringTone[intel.tone])}
                stroke="currentColor"
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-lg font-black leading-none text-ink">{intel.score}</span>
              <span className="text-[0.55rem] font-medium text-faint">Health</span>
            </div>
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <p className="font-semibold text-ink">Account-Intelligenz</p>
              <Badge tone={badgeTone[intel.tone]}>{intel.label}</Badge>
            </div>
            <p className="mt-1 flex items-start gap-1.5 text-sm text-brand-deep">
              <IconChevronRight size={14} className="mt-0.5 flex-none" />
              <span className="font-medium">{intel.nextAction}</span>
            </p>
          </div>
        </div>

        {/* Faktoren */}
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
