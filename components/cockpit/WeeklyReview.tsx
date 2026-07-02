"use client";

import { useState, useTransition } from "react";
import { Card, CardBody, SectionHeader } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { IconSpark, IconPhone, IconMail, IconCheck, IconTarget, IconUserCheck } from "@/components/ui/icons";
import { narrateWeeklyReviewAction } from "@/lib/ai-actions";

export interface WeeklyReviewInput {
  calls: number;
  emails: number;
  kiActivities: number;
  recruitingActivities: number;
  /** Neu erfasste Kandidat:innen diese Woche. */
  newCandidates: number;
  /** Erteilte DSGVO-Einwilligungen diese Woche. */
  consentsGranted: number;
  /** Neue Matches/Vorstellungen diese Woche. */
  presentations: number;
  atRisk: number;
  kritisch: number;
  wichtig: number;
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <div className="rounded-xl border border-border bg-surface px-3 py-2 text-center">
      <div className="mx-auto mb-1 flex h-6 w-6 items-center justify-center rounded-lg bg-elevated text-muted">{icon}</div>
      <p className="text-lg font-black tabular-nums text-ink">{value}</p>
      <p className="text-[0.65rem] text-faint">{label}</p>
    </div>
  );
}

/** Freitags-Wochen-Review: Zahlen der Woche + KI-Zusammenfassung. */
export function WeeklyReview({ input }: { input: WeeklyReviewInput }) {
  const [pending, start] = useTransition();
  const [text, setText] = useState<string | null>(null);
  const [mode, setMode] = useState<"live" | "demo">("demo");
  const [error, setError] = useState<string | null>(null);

  function run() {
    setError(null);
    start(async () => {
      const res = await narrateWeeklyReviewAction(input);
      if (res.ok && res.text) {
        setText(res.text);
        setMode(res.mode ?? "demo");
      } else {
        setError(res.error ?? "Review fehlgeschlagen.");
      }
    });
  }

  return (
    <Card className="border-sky/30 bg-gradient-to-br from-sky/[0.06] to-surface">
      <CardBody className="space-y-4">
        <SectionHeader title="Wochen-Review" hint="Freitag · Bilanz & Fokus für nächste Woche" />

        <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
          <Stat icon={<IconPhone size={13} />} label="Calls" value={input.calls} />
          <Stat icon={<IconMail size={13} />} label="E-Mails" value={input.emails} />
          <Stat icon={<IconUserCheck size={13} />} label="Kandidat:innen" value={input.newCandidates} />
          <Stat icon={<IconCheck size={13} />} label="Einwilligungen" value={input.consentsGranted} />
          <Stat icon={<IconTarget size={13} />} label="Vorstellungen" value={input.presentations} />
          <Stat icon={<IconSpark size={13} />} label="kritisch" value={input.kritisch} />
        </div>

        <div className="rounded-xl border border-border bg-surface/70 p-3">
          {text ? (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="kpi-label">KI-Review</span>
                <Badge tone={mode === "live" ? "success" : "warning"}>{mode === "live" ? "KI" : "Heuristik"}</Badge>
              </div>
              <p className="text-sm leading-relaxed text-ink">{text}</p>
            </div>
          ) : (
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-sm text-muted">Lass die Woche von der KI auf den Punkt bringen.</span>
              <button
                type="button"
                onClick={run}
                disabled={pending}
                className="inline-flex items-center gap-1.5 rounded-lg border border-sky/40 bg-sky/10 px-2.5 py-1.5 text-xs font-semibold text-sky-deep transition-colors hover:bg-sky/15 disabled:opacity-60"
              >
                <IconSpark size={13} /> {pending ? "Fasse zusammen …" : "Wochen-Review erstellen"}
              </button>
            </div>
          )}
          {error ? <p className="mt-2 text-xs text-danger">{error}</p> : null}
        </div>
      </CardBody>
    </Card>
  );
}
