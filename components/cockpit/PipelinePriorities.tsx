"use client";

import { useState, useTransition } from "react";
import { Card, CardBody } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { LineBadge } from "@/components/cockpit/LineBadge";
import { IconSpark, IconChevronRight } from "@/components/ui/icons";
import { cn } from "@/components/ui/cn";
import { prioritizePipelineAction } from "@/lib/ai-actions";
import type { ScoredOpp, Priority } from "@/lib/ai/types";
import type { BusinessLine } from "@/lib/crm-types";

const priorityTone: Record<Priority, "success" | "warning" | "neutral"> = {
  hoch: "success",
  mittel: "warning",
  niedrig: "neutral",
};

/** KI-sortierte „Heute zuerst"-Liste über die offene Pipeline. */
export function PipelinePriorities() {
  const [pending, start] = useTransition();
  const [items, setItems] = useState<ScoredOpp[] | null>(null);
  const [mode, setMode] = useState<"live" | "demo">("demo");
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  function run() {
    setError(null);
    setOpen(true);
    start(async () => {
      const res = await prioritizePipelineAction();
      if (res.ok && res.items) {
        setItems(res.items);
        setMode(res.mode ?? "demo");
      } else {
        setError(res.error ?? "Fehler");
      }
    });
  }

  return (
    <Card className="border-brand/30 bg-gradient-to-br from-brand/[0.05] to-sky/[0.04]">
      <CardBody>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-start gap-3">
            <span className="mt-0.5 flex h-9 w-9 flex-none items-center justify-center rounded-xl bg-brand/10 text-brand-deep">
              <IconSpark size={18} />
            </span>
            <div>
              <p className="font-semibold text-ink">KI-Priorisierung</p>
              <p className="text-sm text-muted">
                Lass die KI deine offene Pipeline sortieren – Score, Priorität und
                die nächste Aktion je Chance.
              </p>
            </div>
          </div>
          <Button onClick={run} disabled={pending} className="flex-none">
            <IconSpark size={16} />
            {pending ? "Bewerte Pipeline …" : "Heute zuerst"}
          </Button>
        </div>

        {error ? (
          <p className="mt-4 rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-xs text-danger">
            {error}
          </p>
        ) : null}

        {open && items ? (
          <div className="mt-4 space-y-1.5">
            <div className="flex items-center justify-between px-1">
              <span className="kpi-label">Heute zuerst</span>
              <Badge tone={mode === "live" ? "success" : "warning"}>
                {mode === "live" ? "KI" : "Heuristik"}
              </Badge>
            </div>
            {items.map((it, i) => (
              <div
                key={it.id}
                className="flex items-start gap-3 rounded-xl border border-border bg-surface px-3 py-2.5"
              >
                <span
                  className={cn(
                    "flex h-6 w-6 flex-none items-center justify-center rounded-lg text-xs font-bold",
                    i < 3
                      ? "bg-gradient-to-br from-brand-deep to-sky-deep text-white"
                      : "bg-elevated text-muted"
                  )}
                >
                  {i + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="truncate text-sm font-medium text-ink">
                      {it.account_name}
                    </p>
                    <LineBadge line={it.line as BusinessLine} />
                  </div>
                  <p className="mt-0.5 flex items-center gap-1 text-xs font-medium text-brand-deep">
                    <IconChevronRight size={12} /> {it.score.next_action}
                  </p>
                </div>
                <div className="flex flex-none flex-col items-end gap-1">
                  <span className="text-sm font-bold text-ink">{it.score.score}</span>
                  <Badge tone={priorityTone[it.score.priority]}>
                    {it.score.priority}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        ) : null}
      </CardBody>
    </Card>
  );
}
