"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { IconSpark, IconCheck } from "@/components/ui/icons";
import { cn } from "@/components/ui/cn";
import {
  matchCandidatesToMandate,
  submitCandidateToMandate,
  analyzeMatch,
  type CandidateMatch,
  type DeepAnalysis,
} from "@/lib/match";

function scoreTone(s: number): string {
  return s >= 70 ? "bg-success" : s >= 45 ? "bg-warning" : "bg-danger";
}

/** „Champions League": Smart Search & Match passender Kandidat:innen zum Mandat. */
export function MandateMatchPanel({ mandateId }: { mandateId: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [matches, setMatches] = useState<CandidateMatch[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState<string | null>(null);
  const [done, setDone] = useState<Set<string>>(new Set());
  const [analysis, setAnalysis] = useState<Record<string, DeepAnalysis | "loading" | "error">>({});

  async function analyze(id: string) {
    if (analysis[id] && analysis[id] !== "error") {
      setAnalysis((a) => {
        const next = { ...a };
        delete next[id];
        return next;
      });
      return;
    }
    setAnalysis((a) => ({ ...a, [id]: "loading" }));
    const res = await analyzeMatch(id, mandateId);
    setAnalysis((a) => ({ ...a, [id]: res.ok && res.analysis ? res.analysis : "error" }));
  }

  function run() {
    setError(null);
    start(async () => {
      const res = await matchCandidatesToMandate(mandateId);
      if (!res.ok) {
        setError(res.error ?? "Match fehlgeschlagen.");
        return;
      }
      setMatches(res.matches ?? []);
    });
  }

  async function present(id: string) {
    setSubmitting(id);
    setError(null);
    const res = await submitCandidateToMandate(id, mandateId);
    setSubmitting(null);
    if (res.ok) {
      setDone((prev) => new Set(prev).add(id));
      if (!res.demo) router.refresh();
    } else {
      setError(res.error ?? "Vorstellen fehlgeschlagen.");
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted">
          Findet per Algorithmus passende Kandidat:innen (Rolle, Region, Gehalt, Verfügbarkeit).
        </p>
        <button
          type="button"
          onClick={run}
          disabled={pending}
          className="inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-brand to-sky px-3 py-2 text-xs font-semibold text-white shadow-glow transition-transform active:scale-95 disabled:opacity-60"
        >
          <IconSpark size={14} /> {pending ? "sucht …" : "Search & Match"}
        </button>
      </div>

      {error ? (
        <p className="rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-xs text-danger">{error}</p>
      ) : null}

      {matches ? (
        matches.length === 0 ? (
          <p className="text-sm text-muted">Keine Kandidat:innen im System.</p>
        ) : (
          <ul className="divide-y divide-border/70">
            {matches.map((m) => {
              const presented = m.already || done.has(m.id);
              return (
                <li key={m.id} className="flex flex-wrap items-center gap-3 py-2.5">
                  <div className="w-10 flex-none text-center">
                    <span className="text-lg font-black tabular-nums text-ink">{m.score}</span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <Link
                      href={`/cockpit/kandidaten/${m.id}`}
                      className="block truncate text-sm font-semibold text-ink hover:text-brand-deep"
                    >
                      {m.name}
                    </Link>
                    <p className="truncate text-xs text-muted">{m.role || "Position offen"}</p>
                    <div className="mt-1 h-1.5 w-full max-w-[14rem] overflow-hidden rounded-full bg-elevated">
                      <div className={cn("h-full rounded-full", scoreTone(m.score))} style={{ width: `${m.score}%` }} />
                    </div>
                    {m.factors.length ? (
                      <div className="mt-1.5 flex flex-wrap gap-1">
                        {m.factors.map((f) => (
                          <span key={f} className="rounded-full bg-success/10 px-2 py-0.5 text-[0.65rem] font-medium text-success">
                            {f}
                          </span>
                        ))}
                      </div>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => analyze(m.id)}
                      className="mt-1.5 inline-flex items-center gap-1 text-[0.7rem] font-medium text-sky-deep hover:underline"
                    >
                      <IconSpark size={11} />
                      {analysis[m.id] === "loading"
                        ? "analysiert …"
                        : analysis[m.id] && analysis[m.id] !== "error"
                          ? "Analyse verbergen"
                          : "KI-Tiefenanalyse"}
                    </button>
                    {analysis[m.id] === "error" ? (
                      <p className="mt-1 text-[0.7rem] text-danger">Analyse nicht möglich.</p>
                    ) : null}
                    {analysis[m.id] && analysis[m.id] !== "loading" && analysis[m.id] !== "error" ? (
                      <AnalysisBlock a={analysis[m.id] as DeepAnalysis} />
                    ) : null}
                  </div>
                  <div className="flex-none">
                    {m.rejected ? (
                      <span className="inline-flex items-center gap-1 rounded-lg border border-danger/30 bg-danger/10 px-2.5 py-1.5 text-xs font-medium text-danger">
                        Absage erhalten
                      </span>
                    ) : presented ? (
                      <span className="inline-flex items-center gap-1 rounded-lg border border-border bg-elevated px-2.5 py-1.5 text-xs font-medium text-muted">
                        <IconCheck size={13} className="text-success" /> Vorgestellt
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => present(m.id)}
                        disabled={submitting === m.id}
                        className="rounded-lg border border-brand/30 bg-brand/10 px-2.5 py-1.5 text-xs font-semibold text-brand-deep hover:bg-brand/15 disabled:opacity-60"
                      >
                        {submitting === m.id ? "…" : "Vorstellen"}
                      </button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )
      ) : null}
    </div>
  );
}

function AnalysisBlock({ a }: { a: DeepAnalysis }) {
  return (
    <div className="mt-2 space-y-1.5 rounded-lg border border-border bg-elevated/50 p-2.5 text-xs">
      <p className="font-semibold text-ink">
        Passung {a.fit}/100
      </p>
      {a.strengths.length ? (
        <p className="text-success">
          <span className="font-medium">Stärken:</span> {a.strengths.join(", ")}
        </p>
      ) : null}
      {a.gaps.length ? (
        <p className="text-warning">
          <span className="font-medium">Lücken:</span> {a.gaps.join(", ")}
        </p>
      ) : null}
      {a.recommendation ? <p className="text-muted">{a.recommendation}</p> : null}
    </div>
  );
}
