"use client";

import { useState } from "react";
import { Card, CardBody, SectionHeader } from "@/components/ui/Card";
import { IconPhone, IconMail, IconCheck, IconBriefcase, IconBolt, IconFlame } from "@/components/ui/icons";
import { cn } from "@/components/ui/cn";
import { ActivityLogger } from "@/components/cockpit/ActivityLogger";
import type { ActivityStats } from "@/lib/activity-data";

const CALL_GOAL = 15;
const EMAIL_GOAL = 10;

interface WeekDay {
  label: string;
  mode: "goal" | "review" | "off";
  score: number;
  isToday: boolean;
  isFuture: boolean;
}

function Bar({ value, goal, tone }: { value: number; goal: number; tone: string }) {
  const pct = Math.min(100, Math.round((value / goal) * 100));
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-elevated">
      <div className={cn("h-full rounded-full transition-all", tone)} style={{ width: `${pct}%` }} />
    </div>
  );
}

export function DailyGoals({
  stats,
  newRecruitingToday,
  newKiToday,
  streak,
  weekDays,
  dayMode,
  callGoalWeek,
  emailGoalWeek,
  accounts = [],
}: {
  stats: ActivityStats;
  newRecruitingToday: boolean;
  newKiToday: boolean;
  streak: number;
  weekDays: WeekDay[];
  dayMode: "work" | "review" | "off";
  callGoalWeek: number;
  emailGoalWeek: number;
  accounts?: string[];
}) {
  const [calls, setCalls] = useState(stats.callsToday);
  const [emails, setEmails] = useState(stats.emailsToday);
  const [wCalls, setWCalls] = useState(stats.weekCalls);
  const [wEmails, setWEmails] = useState(stats.weekEmails);
  const [week, setWeek] = useState(stats.week);

  // Optimistische Zähler beim Erfassen aktualisieren.
  function onLogged(kind: "call" | "email", line: "ki" | "recruiting") {
    if (kind === "call") {
      setCalls((c) => c + 1);
      setWCalls((c) => c + 1);
    } else {
      setEmails((c) => c + 1);
      setWEmails((c) => c + 1);
    }
    setWeek((w) => ({ ...w, [line]: { ...w[line], [kind]: w[line][kind] + 1 } }));
  }

  const goalsDone =
    (calls >= CALL_GOAL ? 1 : 0) +
    (emails >= EMAIL_GOAL ? 1 : 0) +
    (newRecruitingToday ? 1 : 0) +
    (newKiToday ? 1 : 0);
  const allDone = goalsDone === 4;

  const kiTotal = week.ki.call + week.ki.email;
  const recTotal = week.recruiting.call + week.recruiting.email;
  const focusTotal = kiTotal + recTotal || 1;

  return (
    <Card className={dayMode === "work" && allDone ? "border-success/40 bg-gradient-to-br from-success/[0.06] to-brand/[0.04]" : undefined}>
      <CardBody className="space-y-4">
        <SectionHeader
          title={dayMode === "review" ? "Freitag · Review & Buchhaltung" : dayMode === "off" ? "Wochenende" : "Tagesziele"}
          hint={dayMode === "work" ? (allDone ? "🎉 Alle Ziele erreicht – stark!" : "Fokus für heute (Mo–Do)") : "Arbeitswoche Mo–Do"}
          action={
            <span className="inline-flex items-center gap-2">
              {streak > 0 ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-warning/15 px-2.5 py-1 text-xs font-bold text-warning"><IconFlame size={12} className="flex-none" /> {streak}</span>
              ) : null}
              {dayMode === "work" ? (
                <span className={cn("rounded-full px-2.5 py-1 text-xs font-bold", allDone ? "bg-success/15 text-success" : "bg-brand/10 text-brand-deep")}>
                  {goalsDone}/4
                </span>
              ) : null}
            </span>
          }
        />

        {streak > 0 ? (
          <p className="-mt-2 flex items-center gap-1.5 text-xs text-muted">
            <IconFlame size={13} className="flex-none text-warning" />
            <span><span className="font-semibold text-ink">{streak} Tag{streak === 1 ? "" : "e"} in Folge</span> alle Tagesziele erreicht.</span>
          </p>
        ) : null}

        {dayMode === "work" ? (
          <>
            {/* Fortschritts-Ziele */}
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-xl border border-border bg-elevated/40 p-3">
                <div className="mb-1.5 flex items-center justify-between text-sm">
                  <span className="inline-flex items-center gap-1.5 font-medium text-ink"><IconPhone size={14} className="text-brand-deep" /> Sales Calls</span>
                  <span className={cn("font-bold tabular-nums", calls >= CALL_GOAL ? "text-success" : "text-ink")}>{calls}/{CALL_GOAL}</span>
                </div>
                <Bar value={calls} goal={CALL_GOAL} tone={calls >= CALL_GOAL ? "bg-success" : "bg-gradient-to-r from-brand to-sky"} />
              </div>
              <div className="rounded-xl border border-border bg-elevated/40 p-3">
                <div className="mb-1.5 flex items-center justify-between text-sm">
                  <span className="inline-flex items-center gap-1.5 font-medium text-ink"><IconMail size={14} className="text-brand-deep" /> Neukunden-E-Mails</span>
                  <span className={cn("font-bold tabular-nums", emails >= EMAIL_GOAL ? "text-success" : "text-ink")}>{emails}/{EMAIL_GOAL}</span>
                </div>
                <Bar value={emails} goal={EMAIL_GOAL} tone={emails >= EMAIL_GOAL ? "bg-success" : "bg-gradient-to-r from-brand to-sky"} />
              </div>
            </div>

            <div className="grid gap-2 sm:grid-cols-2">
              <GoalFlag done={newRecruitingToday} icon={<IconBriefcase size={14} />} label="Neues Recruiting-Projekt" />
              <GoalFlag done={newKiToday} icon={<IconBolt size={14} />} label="Neues KI-/Tel.-Projekt" />
            </div>
          </>
        ) : (
          <div className="rounded-xl border border-sky/30 bg-sky/[0.05] px-3 py-2.5 text-sm text-ink">
            {dayMode === "review"
              ? "Heute kein Akquise-Ziel – Zeit für Wochen-Review, Forecast-Pflege & Buchhaltung. Deine Wochenbilanz:"
              : "Wochenende – frei. Deine Wochenbilanz:"}
          </div>
        )}

        {/* Wochenziele (Mo–Do) */}
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-xl border border-border bg-elevated/40 p-3">
            <div className="mb-1.5 flex items-center justify-between text-xs">
              <span className="font-medium text-muted">Wochenziel Calls</span>
              <span className={cn("font-bold tabular-nums", wCalls >= callGoalWeek ? "text-success" : "text-ink")}>{wCalls}/{callGoalWeek}</span>
            </div>
            <Bar value={wCalls} goal={callGoalWeek} tone={wCalls >= callGoalWeek ? "bg-success" : "bg-gradient-to-r from-brand to-sky"} />
          </div>
          <div className="rounded-xl border border-border bg-elevated/40 p-3">
            <div className="mb-1.5 flex items-center justify-between text-xs">
              <span className="font-medium text-muted">Wochenziel E-Mails</span>
              <span className={cn("font-bold tabular-nums", wEmails >= emailGoalWeek ? "text-success" : "text-ink")}>{wEmails}/{emailGoalWeek}</span>
            </div>
            <Bar value={wEmails} goal={emailGoalWeek} tone={wEmails >= emailGoalWeek ? "bg-success" : "bg-gradient-to-r from-brand to-sky"} />
          </div>
        </div>

        {/* Mini-Wochenübersicht Mo–So */}
        <div className="flex items-center justify-between gap-1.5">
          {weekDays.map((d, i) => (
            <DayDot key={i} day={d} />
          ))}
        </div>

        {/* Schnell-Logger (immer verfügbar) */}
        <ActivityLogger accounts={accounts} onLogged={onLogged} />

        {/* Wochenfokus */}
        <div>
          <div className="mb-1 flex items-center justify-between text-xs text-faint">
            <span>Wochenfokus (Mo–Do · Calls + E-Mails)</span>
            <span>{kiTotal + recTotal} gesamt</span>
          </div>
          <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-elevated">
            <div className="h-full bg-sky" style={{ width: `${(kiTotal / focusTotal) * 100}%` }} title={`KI: ${kiTotal}`} />
            <div className="h-full bg-brand" style={{ width: `${(recTotal / focusTotal) * 100}%` }} title={`Recruiting: ${recTotal}`} />
          </div>
          <div className="mt-1 flex items-center justify-between text-[0.7rem]">
            <span className="text-sky-deep">● KI {kiTotal}</span>
            <span className="text-brand-deep">Recruiting {recTotal} ●</span>
          </div>
        </div>
      </CardBody>
    </Card>
  );
}

function DayDot({ day }: { day: WeekDay }) {
  let dot = "bg-elevated text-faint";
  let title = "";
  if (day.mode === "review") {
    dot = "bg-sky/15 text-sky-deep";
    title = "Review & Buchhaltung";
  } else if (day.mode === "off") {
    dot = "bg-elevated/60 text-faint";
    title = "frei";
  } else if (!day.isFuture) {
    if (day.score === 4) {
      dot = "bg-success/20 text-success";
      title = "alle Ziele erreicht";
    } else if (day.score > 0) {
      dot = "bg-warning/20 text-warning";
      title = `${day.score}/4 Ziele`;
    } else {
      dot = "bg-danger/15 text-danger";
      title = "0/4 Ziele";
    }
  }
  return (
    <div className="flex flex-1 flex-col items-center gap-1" title={title}>
      <span className="text-[0.65rem] font-medium text-faint">{day.label}</span>
      <span className={cn("flex h-7 w-7 items-center justify-center rounded-full text-[0.65rem] font-bold", dot, day.isToday && "ring-2 ring-brand ring-offset-1 ring-offset-surface")}>
        {day.mode === "review" ? "R" : day.mode === "off" ? "–" : day.isFuture ? "·" : day.score === 4 ? "✓" : day.score}
      </span>
    </div>
  );
}

function GoalFlag({ done, icon, label }: { done: boolean; icon: React.ReactNode; label: string }) {
  return (
    <div className={cn("flex items-center gap-2 rounded-xl border px-3 py-2.5 text-sm", done ? "border-success/40 bg-success/[0.06]" : "border-border bg-elevated/40")}>
      <span className={cn("flex h-6 w-6 flex-none items-center justify-center rounded-full", done ? "bg-success/15 text-success" : "bg-elevated text-faint")}>
        {done ? <IconCheck size={14} /> : icon}
      </span>
      <span className={cn("font-medium", done ? "text-ink" : "text-muted")}>{label}</span>
      <span className={cn("ml-auto text-xs font-semibold", done ? "text-success" : "text-faint")}>{done ? "erreicht" : "offen"}</span>
    </div>
  );
}
