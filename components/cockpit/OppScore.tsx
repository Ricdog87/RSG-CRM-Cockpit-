"use client";

import { useState, useTransition } from "react";
import { Badge } from "@/components/ui/Badge";
import { IconSpark } from "@/components/ui/icons";
import { cn } from "@/components/ui/cn";
import { scoreOpportunityAction } from "@/lib/ai-actions";
import type { OppScore as OppScoreT, OppScoreInput, Priority } from "@/lib/ai/types";

const priorityTone: Record<Priority, "success" | "warning" | "neutral"> = {
  hoch: "success",
  mittel: "warning",
  niedrig: "neutral",
};

/** KI-Score + nächste beste Aktion für eine Verkaufschance (on demand). */
export function OppScore({ input }: { input: OppScoreInput }) {
  const [pending, start] = useTransition();
  const [score, setScore] = useState<OppScoreT | null>(null);
  const [error, setError] = useState<string | null>(null);

  function run() {
    setError(null);
    start(async () => {
      const res = await scoreOpportunityAction(input);
      if (res.ok && res.score) setScore(res.score);
      else setError(res.error ?? "Fehler");
    });
  }

  if (score) {
    return (
      <div className="mt-2 rounded-lg border border-border bg-surface p-2">
        <div className="flex items-center justify-between">
          <span className="inline-flex items-center gap-1 text-xs font-semibold text-brand-deep">
            <IconSpark size={13} /> KI-Score {score.score}
          </span>
          <Badge tone={priorityTone[score.priority]}>{score.priority}</Badge>
        </div>
        <p className="mt-1.5 text-xs font-medium text-ink">→ {score.next_action}</p>
        {score.reasoning ? (
          <p className="mt-0.5 text-[0.7rem] text-faint">{score.reasoning}</p>
        ) : null}
        <button
          type="button"
          onClick={run}
          disabled={pending}
          className="mt-1 text-[0.7rem] text-faint hover:text-muted"
        >
          {pending ? "…" : "neu bewerten"}
        </button>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={run}
      disabled={pending}
      className={cn(
        "mt-2 inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-border bg-surface px-2 py-1.5 text-xs font-medium text-muted transition-colors hover:border-brand/40 hover:text-brand-deep",
        pending && "opacity-60"
      )}
    >
      <IconSpark size={13} />
      {pending ? "Bewerte …" : error ? "Erneut versuchen" : "KI-Score & nächste Aktion"}
    </button>
  );
}
