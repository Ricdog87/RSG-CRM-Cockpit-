"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Card, CardBody } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { LineBadge } from "@/components/cockpit/LineBadge";
import { cn } from "@/components/ui/cn";
import {
  IconSpark,
  IconChevronRight,
  IconTasks,
  IconClock,
  IconTrendingUp,
  IconBriefcase,
  IconEuro,
  IconUserCheck,
  IconPhone,
  IconAlertTriangle,
} from "@/components/ui/icons";
import { narrateBriefingAction } from "@/lib/ai-actions";
import { formatEur } from "@/lib/format";
import type { BusinessLine } from "@/lib/crm-types";

type Severity = "kritisch" | "wichtig" | "chance";

interface Signal {
  id: string;
  severity: Severity;
  category: string;
  title: string;
  detail: string;
  action: string;
  href: string;
  line?: BusinessLine;
  value: number;
}

const sevMeta: Record<Severity, { tone: "danger" | "warning" | "sky"; ring: string; dot: string; label: string }> = {
  kritisch: { tone: "danger", ring: "border-danger/40", dot: "bg-danger", label: "Kritisch" },
  wichtig: { tone: "warning", ring: "border-warning/40", dot: "bg-warning", label: "Wichtig" },
  chance: { tone: "sky", ring: "border-sky/40", dot: "bg-sky", label: "Chance" },
};

const catIcon: Record<string, React.ComponentType<{ size?: number; className?: string }>> = {
  Aufgabe: IconTasks,
  Renewal: IconClock,
  Pipeline: IconTrendingUp,
  Recruiting: IconBriefcase,
  Rechnung: IconEuro,
  Kandidaten: IconUserCheck,
  Akquise: IconPhone,
};

/**
 * Intelligentes Tages-Briefing: priorisierte Handlungssignale aus den echten
 * CRM-Daten + optionale KI-Coaching-Zusammenfassung (on-demand).
 */
export function DailyBriefing({
  signals,
  counts,
  atRisk,
}: {
  signals: Signal[];
  counts: { kritisch: number; wichtig: number; chance: number };
  atRisk: number;
}) {
  const [pending, start] = useTransition();
  const [narration, setNarration] = useState<string | null>(null);
  const [mode, setMode] = useState<"live" | "demo">("demo");
  const [error, setError] = useState<string | null>(null);

  function coach() {
    setError(null);
    start(async () => {
      const res = await narrateBriefingAction();
      if (res.ok && res.text) {
        setNarration(res.text);
        setMode(res.mode ?? "demo");
      } else {
        setError(res.error ?? "Briefing fehlgeschlagen.");
      }
    });
  }

  const allClear = signals.length === 0;

  return (
    <Card className="border-brand/30 bg-gradient-to-br from-brand/[0.06] via-surface to-sky/[0.05]">
      <CardBody className="space-y-4">
        {/* Kopf */}
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <span className="mt-0.5 flex h-9 w-9 flex-none items-center justify-center rounded-xl bg-gradient-to-br from-brand-deep to-sky-deep text-white shadow-glow">
              <IconSpark size={18} />
            </span>
            <div>
              <p className="font-semibold text-ink">Tages-Briefing</p>
              <p className="text-sm text-muted">
                {allClear
                  ? "Keine akuten Brennpunkte – Zeit für Akquise."
                  : "Deine wichtigsten Hebel heute – intelligent priorisiert."}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            {counts.kritisch > 0 ? <Badge tone="danger">{counts.kritisch} kritisch</Badge> : null}
            {counts.wichtig > 0 ? <Badge tone="warning">{counts.wichtig} wichtig</Badge> : null}
            {counts.chance > 0 ? <Badge tone="sky">{counts.chance} Chancen</Badge> : null}
          </div>
        </div>

        {/* € auf dem Spiel */}
        {atRisk > 0 ? (
          <div className="flex items-center gap-2 rounded-xl border border-warning/30 bg-warning/[0.06] px-3 py-2 text-sm">
            <IconAlertTriangle size={15} className="flex-none text-warning" />
            <span className="text-ink">
              <span className="font-bold">{formatEur(atRisk)}</span> stehen zur Entscheidung an oder sind gefährdet.
            </span>
          </div>
        ) : null}

        {/* KI-Coaching */}
        <div className="rounded-xl border border-border bg-surface/70 p-3">
          {narration ? (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="kpi-label">KI-Coach</span>
                <Badge tone={mode === "live" ? "success" : "warning"}>{mode === "live" ? "KI" : "Heuristik"}</Badge>
              </div>
              <p className="text-sm leading-relaxed text-ink">{narration}</p>
            </div>
          ) : (
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-sm text-muted">Lass dir den Tag in einem Satz auf den Punkt bringen.</span>
              <button
                type="button"
                onClick={coach}
                disabled={pending}
                className="inline-flex items-center gap-1.5 rounded-lg border border-brand/40 bg-brand/10 px-2.5 py-1.5 text-xs font-semibold text-brand-deep transition-colors hover:bg-brand/15 disabled:opacity-60"
              >
                <IconSpark size={13} /> {pending ? "Denke nach …" : "KI-Briefing erstellen"}
              </button>
            </div>
          )}
          {error ? <p className="mt-2 text-xs text-danger">{error}</p> : null}
        </div>

        {/* Signal-Liste */}
        {allClear ? (
          <div className="rounded-xl border border-success/30 bg-success/[0.05] px-4 py-6 text-center">
            <p className="text-sm font-medium text-ink">Alles im grünen Bereich 🎯</p>
            <p className="mt-1 text-xs text-muted">Keine überfälligen Aufgaben, Renewals oder gefährdeten Abschlüsse.</p>
          </div>
        ) : (
          <ul className="space-y-2">
            {signals.map((s) => {
              const meta = sevMeta[s.severity];
              const Icon = catIcon[s.category] ?? IconChevronRight;
              return (
                <li key={s.id}>
                  <Link
                    href={s.href}
                    className={cn(
                      "group flex items-start gap-3 rounded-xl border bg-surface px-3 py-2.5 transition-colors hover:border-brand/40 hover:bg-brand/[0.03]",
                      meta.ring
                    )}
                  >
                    <span className={cn("mt-1 h-2 w-2 flex-none rounded-full", meta.dot)} />
                    <span className="mt-0.5 flex h-7 w-7 flex-none items-center justify-center rounded-lg bg-elevated text-muted">
                      <Icon size={14} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="truncate text-sm font-semibold text-ink">{s.title}</p>
                        {s.line ? <LineBadge line={s.line} /> : null}
                        <span className="text-[0.65rem] font-medium uppercase tracking-wider text-faint">{s.category}</span>
                      </div>
                      <p className="mt-0.5 text-xs text-muted">{s.detail}</p>
                      <p className="mt-1 flex items-center gap-1 text-xs font-medium text-brand-deep">
                        <IconChevronRight size={12} className="transition-transform group-hover:translate-x-0.5" /> {s.action}
                      </p>
                    </div>
                    {s.value > 0 ? (
                      <span className="flex-none self-center text-xs font-bold text-ink">{formatEur(s.value)}</span>
                    ) : null}
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </CardBody>
    </Card>
  );
}
