"use client";

import { useState, useTransition } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { useRouter } from "next/navigation";
import { Card, CardBody, SectionHeader } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { IconSpark, IconPlus, IconCheck } from "@/components/ui/icons";
import { discoverLeadsAction, importLeadAsAccount } from "@/lib/ai-actions";
import type { LeadCandidate, RecommendedLine } from "@/lib/ai/types";

const lineMeta: Record<RecommendedLine, { label: string; tone: "brand" | "sky" | "success" | "neutral" }> = {
  ki: { label: "RSG AI", tone: "sky" },
  recruiting: { label: "RSG Recruiting", tone: "brand" },
  beide: { label: "Beide", tone: "success" },
  keine: { label: "Kein Fit", tone: "neutral" },
};

const inputClass =
  "w-full rounded-xl border border-border bg-surface px-3 py-2 text-sm text-ink placeholder:text-faint focus-visible:ring-2 focus-visible:ring-brand";

function SearchButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} className="w-full sm:w-auto">
      <IconSpark size={16} /> {pending ? "Suche läuft …" : "Ziel-Accounts finden"}
    </Button>
  );
}

function ImportRow({ candidate }: { candidate: LeadCandidate }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [done, setDone] = useState(false);

  return done ? (
    <span className="inline-flex items-center gap-1 text-xs text-success">
      <IconCheck size={14} /> übernommen
    </span>
  ) : (
    <button
      type="button"
      disabled={pending}
      onClick={() =>
        start(async () => {
          const fd = new FormData();
          fd.set("name", candidate.company);
          fd.set("branche", candidate.industry);
          fd.set("ort", candidate.location);
          fd.set("recommended_line", candidate.recommended_line);
          const res = await importLeadAsAccount(fd);
          if (res.ok) {
            setDone(true);
            if (!res.demo) router.refresh();
          }
        })
      }
      className="inline-flex items-center gap-1 rounded-lg border border-border bg-surface px-2 py-1 text-xs font-medium text-muted hover:border-brand/40 hover:text-brand-deep disabled:opacity-50"
    >
      <IconPlus size={13} /> {pending ? "…" : "Übernehmen"}
    </button>
  );
}

export function LeadDiscovery() {
  const [state, formAction] = useFormState(discoverLeadsAction, null);
  const result = state?.ok ? state.result : undefined;

  return (
    <Card className="border-brand/30 bg-gradient-to-br from-brand/[0.05] to-sky/[0.04]">
      <CardBody className="space-y-4">
        <SectionHeader
          title="Lead-Discovery"
          hint="Idealprofil eingeben – die KI schlägt Ziel-Accounts vor"
        />

        <form action={formAction} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <input name="branche" placeholder="Branche (z.B. Praxen)" className={inputClass} />
          <input name="region" placeholder="Region (z.B. NRW)" className={inputClass} />
          <input name="size" placeholder="Größe (z.B. 10–50 MA)" className={inputClass} />
          <select name="focus" defaultValue="beide" className={inputClass}>
            <option value="beide">Beide Linien</option>
            <option value="ki">Fokus RSG AI</option>
            <option value="recruiting">Fokus Recruiting</option>
          </select>
          <input
            name="notes"
            placeholder="Zusatz (optional)"
            className={`${inputClass} sm:col-span-2 lg:col-span-3`}
          />
          <SearchButton />
        </form>

        {state?.error ? (
          <p className="rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-xs text-danger">
            {state.error}
          </p>
        ) : null}

        {result ? (
          <div className="animate-fade-up space-y-2">
            <div className="flex items-center justify-between px-1">
              <span className="kpi-label">{result.candidates.length} Vorschläge</span>
              <div className="flex items-center gap-2">
                {result.grounded ? <Badge tone="sky">web-gestützt</Badge> : null}
                <Badge tone={result.mode === "live" ? "success" : "warning"}>
                  {result.mode === "live" ? "KI" : "Demo"}
                </Badge>
              </div>
            </div>
            {result.candidates.map((c, i) => (
              <div
                key={i}
                className="flex items-start justify-between gap-3 rounded-xl border border-border bg-surface px-3 py-2.5"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="truncate text-sm font-medium text-ink">{c.company}</p>
                    <Badge tone={lineMeta[c.recommended_line].tone}>
                      {lineMeta[c.recommended_line].label}
                    </Badge>
                    <span className="text-xs font-semibold text-brand-deep">Fit {c.fit_score}</span>
                  </div>
                  <p className="mt-0.5 text-xs text-faint">
                    {c.industry} · {c.location}
                  </p>
                  {c.why_fit ? <p className="mt-1 text-xs text-muted">{c.why_fit}</p> : null}
                </div>
                <div className="flex-none pt-0.5">
                  <ImportRow candidate={c} />
                </div>
              </div>
            ))}
          </div>
        ) : null}
      </CardBody>
    </Card>
  );
}
