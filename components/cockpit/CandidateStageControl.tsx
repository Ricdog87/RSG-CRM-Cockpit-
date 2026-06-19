"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { MoveSelect } from "@/components/cockpit/MoveSelect";
import { updateCandidateStage } from "@/lib/crm-actions";
import { toast } from "@/lib/toast";
import type { CandidateStage } from "@/lib/crm-types";

const STAGE_OPTIONS = [
  { value: "neu" as const, label: "Neu" },
  { value: "screening" as const, label: "Screening" },
  { value: "interview" as const, label: "Interview" },
  { value: "angebot" as const, label: "Angebot" },
  { value: "platziert" as const, label: "Platziert" },
  { value: "abgelehnt" as const, label: "Abgelehnt" },
];

/** Phasenwechsel auf der Kandidaten-Detailseite. */
export function CandidateStageControl({
  id,
  stage,
}: {
  id: string;
  stage: CandidateStage;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();

  function move(next: CandidateStage) {
    start(async () => {
      const res = await updateCandidateStage(id, next);
      if (res.ok && !res.demo) router.refresh();
      else if (!res.ok) toast.error(res.error ?? "Phasenwechsel fehlgeschlagen.");
    });
  }

  return (
    <div className={pending ? "opacity-60" : undefined}>
      <MoveSelect<CandidateStage>
        value={stage}
        options={STAGE_OPTIONS}
        onMove={move}
      />
    </div>
  );
}
