"use client";

import { useState, useTransition } from "react";
import { Card, CardBody, SectionHeader } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { IconSpark } from "@/components/ui/icons";
import { enrichAccountAction } from "@/lib/ai-actions";
import type { LeadResult, RecommendedLine } from "@/lib/ai/types";

const lineMeta: Record<RecommendedLine, { label: string; tone: "brand" | "sky" | "success" | "neutral" }> = {
  ki: { label: "RSG AI", tone: "sky" },
  recruiting: { label: "RSG Recruiting", tone: "brand" },
  beide: { label: "Beide Linien", tone: "success" },
  keine: { label: "Kein Fit", tone: "neutral" },
};

function List({ title, items }: { title: string; items: string[] }) {
  if (items.length === 0) return null;
  return (
    <div>
      <p className="kpi-label mb-2">{title}</p>
      <ul className="space-y-1.5">
        {items.map((s, i) => (
          <li key={i} className="flex gap-2 text-sm text-muted">
            <span className="mt-1.5 h-1 w-1 flex-none rounded-full bg-brand" />
            {s}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function AccountEnrich({
  company,
  domain,
  notes,
}: {
  company: string;
  domain?: string;
  notes?: string;
}) {
  const [pending, start] = useTransition();
  const [result, setResult] = useState<LeadResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  function run() {
    setError(null);
    start(async () => {
      const res = await enrichAccountAction({ company, domain, notes });
      if (res.ok && res.result) setResult(res.result);
      else setError(res.error ?? "Fehler");
    });
  }

  return (
    <Card className="border-brand/30 bg-gradient-to-br from-brand/[0.05] to-sky/[0.04]">
      <CardBody className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <SectionHeader title="KI-Analyse" hint="Eignung, Signale & Ansprache" />
          <Button onClick={run} disabled={pending} className="flex-none">
            <IconSpark size={16} />
            {pending ? "Analysiere …" : result ? "Neu analysieren" : "KI-Analyse"}
          </Button>
        </div>

        {error ? (
          <p className="rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-xs text-danger">
            {error}
          </p>
        ) : null}

        {!result && !pending ? (
          <p className="text-sm text-muted">
            Lass die KI diesen Account einschätzen – passende Linie, Kaufsignale,
            Schmerzpunkte, Gesprächsaufhänger und einen fertigen Erstkontakt.
          </p>
        ) : null}

        {result ? (
          <div className="animate-fade-up space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone={lineMeta[result.analysis.recommended_line].tone}>
                {lineMeta[result.analysis.recommended_line].label}
              </Badge>
              <Badge tone="brand">Fit {result.analysis.fit_score}</Badge>
              <Badge tone={result.mode === "live" ? "success" : "warning"}>
                {result.mode === "live" ? "KI" : "Demo"}
              </Badge>
              {result.grounded ? <Badge tone="sky">web-gestützt</Badge> : null}
            </div>

            <p className="text-sm text-muted">{result.analysis.summary}</p>

            <div className="grid gap-4 sm:grid-cols-2">
              <List title="Kaufsignale" items={result.analysis.signals} />
              <List title="Schmerzpunkte" items={result.analysis.pain_points} />
            </div>
            <List title="Gesprächsaufhänger" items={result.analysis.talking_points} />

            {result.analysis.outreach_email ? (
              <div>
                <p className="kpi-label mb-2">Entwurf Erstkontakt</p>
                <div className="rounded-xl border border-border bg-surface p-3">
                  <p className="whitespace-pre-line text-sm text-ink">
                    {result.analysis.outreach_email}
                  </p>
                </div>
              </div>
            ) : null}
          </div>
        ) : null}
      </CardBody>
    </Card>
  );
}
