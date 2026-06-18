import { IconSpark, IconChevronRight } from "@/components/ui/icons";
import { cn } from "@/components/ui/cn";
import { NextActionButton } from "@/components/cockpit/NextActionButton";
import type { CandidateIntel } from "@/lib/candidate-intel";

const tone: Record<string, string> = {
  success: "border-success/30 bg-success/[0.05] text-success",
  sky: "border-sky/30 bg-sky/[0.05] text-sky-deep",
  warning: "border-warning/30 bg-warning/[0.05] text-warning",
  danger: "border-danger/30 bg-danger/[0.05] text-danger",
};

/** Kompakte Kandidaten-Empfehlung (nächster Schritt) – platzsparend. */
export function CandidateIntelHint({
  intel,
  candidateId,
  candidateName,
}: {
  intel: CandidateIntel;
  candidateId: string;
  candidateName: string;
}) {
  return (
    <div className={cn("flex flex-wrap items-center gap-2 rounded-xl border px-3 py-2", tone[intel.tone])}>
      <IconSpark size={14} className="flex-none" />
      <span className="min-w-0 flex-1 text-sm">
        <span className="font-semibold">Nächster Schritt:</span>{" "}
        <span className="text-ink">{intel.recommendation}</span>
      </span>
      <NextActionButton
        accountId={candidateId}
        accountName={candidateName}
        action={intel.recommendation}
        relatedType="candidate"
      />
    </div>
  );
}
