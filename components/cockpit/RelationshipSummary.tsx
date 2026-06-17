"use client";

import { useState, useTransition } from "react";
import { Badge } from "@/components/ui/Badge";
import { IconSpark } from "@/components/ui/icons";
import { summarizeAccountAction } from "@/lib/ai-actions";
import type { BusinessLine } from "@/lib/crm-types";

interface Touchpoint {
  kind: "note" | "email";
  date?: string;
  direction?: "outbound" | "inbound";
  text: string;
}

/** KI-Beziehungs-Zusammenfassung aus Notizen + E-Mails (on-demand). */
export function RelationshipSummary({
  account,
  line,
  touchpoints,
}: {
  account: string;
  line: BusinessLine;
  touchpoints: Touchpoint[];
}) {
  const [pending, start] = useTransition();
  const [summary, setSummary] = useState<string | null>(null);
  const [mode, setMode] = useState<"live" | "demo">("demo");
  const [error, setError] = useState<string | null>(null);

  function run() {
    setError(null);
    start(async () => {
      const res = await summarizeAccountAction({ account, line, touchpoints });
      if (res.ok && res.summary) {
        setSummary(res.summary);
        setMode(res.mode ?? "demo");
      } else {
        setError(res.error ?? "Fehlgeschlagen.");
      }
    });
  }

  return (
    <div className="rounded-xl border border-border bg-surface/70 p-3">
      {summary ? (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="kpi-label">KI-Beziehungsstand</span>
            <Badge tone={mode === "live" ? "success" : "warning"}>{mode === "live" ? "KI" : "Heuristik"}</Badge>
          </div>
          <p className="text-sm leading-relaxed text-ink">{summary}</p>
          <button type="button" onClick={run} disabled={pending} className="text-xs font-medium text-brand-deep hover:underline disabled:opacity-60">
            {pending ? "…" : "Neu zusammenfassen"}
          </button>
        </div>
      ) : (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-sm text-muted">Beziehungsstand aus Notizen &amp; E-Mails zusammenfassen.</span>
          <button
            type="button"
            onClick={run}
            disabled={pending}
            className="inline-flex items-center gap-1.5 rounded-lg border border-brand/40 bg-brand/10 px-2.5 py-1.5 text-xs font-semibold text-brand-deep transition-colors hover:bg-brand/15 disabled:opacity-60"
          >
            <IconSpark size={13} /> {pending ? "Fasse zusammen …" : "KI-Zusammenfassung"}
          </button>
        </div>
      )}
      {error ? <p className="mt-2 text-xs text-danger">{error}</p> : null}
    </div>
  );
}
