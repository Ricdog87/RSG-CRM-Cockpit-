"use client";

import { useState, useTransition } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { useRouter } from "next/navigation";
import { Card, CardBody, SectionHeader } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { IconSpark, IconCheck, IconAlert, IconPlus } from "@/components/ui/icons";
import { cn } from "@/components/ui/cn";
import { runLeadAnalysis, importLeadAsAccount } from "@/lib/ai-actions";
import type { LeadAnalysis, RecommendedLine } from "@/lib/ai/types";

const lineMeta: Record<RecommendedLine, { label: string; tone: "brand" | "sky" | "success" | "neutral" }> = {
  ki: { label: "RSG AI", tone: "sky" },
  recruiting: { label: "RSG Recruiting", tone: "brand" },
  beide: { label: "Beide Linien", tone: "success" },
  keine: { label: "Kein Fit", tone: "neutral" },
};

const inputClass =
  "w-full rounded-xl border border-border bg-surface px-3.5 py-2.5 text-sm text-ink placeholder:text-faint focus-visible:ring-2 focus-visible:ring-brand";

function AnalyzeButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      <IconSpark size={16} /> {pending ? "Analysiere …" : "Lead analysieren"}
    </Button>
  );
}

function ScoreRing({ score }: { score: number }) {
  const tone =
    score >= 70 ? "text-success" : score >= 45 ? "text-sky-deep" : "text-faint";
  return (
    <div className="flex flex-col items-center">
      <div className="relative flex h-20 w-20 items-center justify-center">
        <svg className="h-20 w-20 -rotate-90" viewBox="0 0 36 36">
          <circle cx="18" cy="18" r="15.5" fill="none" stroke="#e1e6ee" strokeWidth="3" />
          <circle
            cx="18"
            cy="18"
            r="15.5"
            fill="none"
            stroke="url(#scoreGrad)"
            strokeWidth="3"
            strokeLinecap="round"
            strokeDasharray={`${(score / 100) * 97.4} 97.4`}
          />
          <defs>
            <linearGradient id="scoreGrad" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#2563eb" />
              <stop offset="100%" stopColor="#0ea5e9" />
            </linearGradient>
          </defs>
        </svg>
        <span className={cn("absolute text-xl font-bold", tone)}>{score}</span>
      </div>
      <span className="mt-1 text-[0.7rem] text-faint">Fit-Score</span>
    </div>
  );
}

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

function ImportButton({ analysis }: { analysis: LeadAnalysis }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [done, setDone] = useState<null | string>(null);

  return (
    <div className="flex items-center gap-3">
      <Button
        variant="ghost"
        disabled={pending || done === "ok"}
        onClick={() =>
          start(async () => {
            const fd = new FormData();
            fd.set("name", analysis.company);
            fd.set("branche", analysis.industry);
            fd.set("segment", analysis.industry);
            fd.set("ort", analysis.location);
            fd.set("recommended_line", analysis.recommended_line);
            const res = await importLeadAsAccount(fd);
            if (res.ok) {
              setDone("ok");
              if (!res.demo) router.refresh();
            } else {
              setDone(res.error ?? "Fehler");
            }
          })
        }
      >
        <IconPlus size={16} /> Als Account übernehmen
      </Button>
      {done === "ok" ? (
        <span className="inline-flex items-center gap-1 text-xs text-success">
          <IconCheck size={14} /> übernommen
        </span>
      ) : done ? (
        <span className="text-xs text-warning">{done}</span>
      ) : null}
    </div>
  );
}

export function LeadIntelligence({
  aiConfigured,
  webResearchEnabled,
}: {
  aiConfigured: boolean;
  webResearchEnabled: boolean;
}) {
  const [state, formAction] = useFormState(runLeadAnalysis, null);
  const result = state?.ok ? state.result : undefined;

  return (
    <div className="grid gap-6 lg:grid-cols-5">
      {/* Eingabe */}
      <div className="lg:col-span-2">
        <Card>
          <CardBody>
            <SectionHeader title="Lead prüfen" hint="Unternehmen eingeben" />
            <form action={formAction} className="space-y-3">
              <div>
                <label htmlFor="company" className="mb-1 block text-xs text-muted">
                  Unternehmen *
                </label>
                <input id="company" name="company" required placeholder="Muster GmbH" className={inputClass} />
              </div>
              <div>
                <label htmlFor="domain" className="mb-1 block text-xs text-muted">
                  Website / Domain
                </label>
                <input id="domain" name="domain" placeholder="muster.de" className={inputClass} />
              </div>
              <div>
                <label htmlFor="notes" className="mb-1 block text-xs text-muted">
                  Notizen (optional)
                </label>
                <textarea id="notes" name="notes" rows={3} placeholder="Was du schon weißt …" className={inputClass} />
              </div>

              {state?.error ? (
                <p className="rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-xs text-danger">
                  {state.error}
                </p>
              ) : null}

              <AnalyzeButton />
            </form>

            <div className="mt-4 space-y-1.5 border-t border-border/60 pt-3 text-xs text-faint">
              <p className="flex items-center gap-1.5">
                <span className={cn("h-1.5 w-1.5 rounded-full", aiConfigured ? "bg-success" : "bg-warning")} />
                {aiConfigured ? "Claude (Opus 4.8) verbunden" : "Demo-Modus – KI nicht verbunden"}
              </p>
              <p className="flex items-center gap-1.5">
                <span className={cn("h-1.5 w-1.5 rounded-full", webResearchEnabled ? "bg-success" : "bg-faint")} />
                {webResearchEnabled ? "Web-Recherche (Perplexity) aktiv" : "Web-Recherche optional"}
              </p>
            </div>
          </CardBody>
        </Card>
      </div>

      {/* Ergebnis */}
      <div className="lg:col-span-3">
        {!result ? (
          <Card>
            <CardBody>
              <div className="flex flex-col items-center justify-center gap-3 py-12 text-center">
                <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand/10 text-brand-deep">
                  <IconSpark size={22} />
                </span>
                <p className="max-w-sm text-sm text-muted">
                  Gib ein Unternehmen ein – die KI bewertet die Eignung für RSG AI und
                  Recruiting, nennt Signale, Schmerzpunkte, Gesprächsaufhänger und einen
                  fertigen Erstkontakt.
                </p>
              </div>
            </CardBody>
          </Card>
        ) : (
          <Card className="animate-fade-up">
            <CardBody className="space-y-5">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-lg font-bold text-ink">{result.analysis.company}</h2>
                    <Badge tone={lineMeta[result.analysis.recommended_line].tone}>
                      {lineMeta[result.analysis.recommended_line].label}
                    </Badge>
                  </div>
                  <p className="mt-1 text-xs text-faint">
                    {result.analysis.industry} · {result.analysis.size_estimate} ·{" "}
                    {result.analysis.location}
                  </p>
                </div>
                <ScoreRing score={result.analysis.fit_score} />
              </div>

              <p className="text-sm text-muted">{result.analysis.summary}</p>

              <div className="grid gap-5 sm:grid-cols-2">
                <List title="Kaufsignale" items={result.analysis.signals} />
                <List title="Schmerzpunkte" items={result.analysis.pain_points} />
              </div>
              <List title="Gesprächsaufhänger" items={result.analysis.talking_points} />

              <div>
                <p className="kpi-label mb-2">Entwurf Erstkontakt</p>
                <div className="rounded-xl border border-border bg-elevated/40 p-3">
                  <p className="whitespace-pre-line text-sm text-ink">
                    {result.analysis.outreach_email}
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border/60 pt-4">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone={result.mode === "live" ? "success" : "warning"}>
                    {result.mode === "live" ? `KI · ${result.model}` : "Demo-Analyse"}
                  </Badge>
                  {result.grounded ? <Badge tone="sky">web-gestützt</Badge> : null}
                  <span className="inline-flex items-center gap-1 text-xs text-faint">
                    <IconAlert size={13} /> Konfidenz: {result.analysis.confidence}
                  </span>
                </div>
                <ImportButton analysis={result.analysis} />
              </div>
            </CardBody>
          </Card>
        )}
      </div>
    </div>
  );
}
