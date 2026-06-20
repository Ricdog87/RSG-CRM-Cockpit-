"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Card, CardBody } from "@/components/ui/Card";
import { IconChevronRight } from "@/components/ui/icons";
import { cn } from "@/components/ui/cn";
import { relatedHref, type RelatedType } from "@/lib/task-link";
import type { Task } from "@/lib/tasks-data";
import type { GoogleEvent } from "@/lib/google-calendar";

const WEEKDAYS = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];
const MONTHS = [
  "Januar", "Februar", "März", "April", "Mai", "Juni",
  "Juli", "August", "September", "Oktober", "November", "Dezember",
];

// ─── Farbdots: CRM-Tasks nach Typ + Google-Events ────────────────────────────

const crmDotColor: Record<RelatedType, string> = {
  customer: "bg-brand",
  candidate: "bg-sky",
  project: "bg-success",
  none: "bg-faint",
};

const GOOGLE_DOT = "bg-[#4285F4]"; // Google-Blau

// ─── Hilfsfunktionen ──────────────────────────────────────────────────────────

function ymd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Extrahiert "YYYY-MM-DD" aus einem Google-Event-Start. */
function googleEventDate(e: GoogleEvent): string | null {
  if (e.start.date) return e.start.date.slice(0, 10);
  if (e.start.dateTime) return e.start.dateTime.slice(0, 10);
  return null;
}

/** Extrahiert "HH:MM" aus einem Google-Event-Start (oder null bei Ganztag). */
function googleEventTime(e: GoogleEvent): string | null {
  if (!e.start.dateTime) return null;
  return e.start.dateTime.slice(11, 16);
}

// ─── Kalender-Zellen-Inhalt ───────────────────────────────────────────────────

interface DayCell {
  crmTasks: Task[];
  googleEvents: GoogleEvent[];
}

// ─── Komponente ───────────────────────────────────────────────────────────────

/**
 * CalendarView
 *
 * Monatlicher Kalender mit CRM-Tasks (farbig nach Typ) und
 * Google-Calendar-Events (Google-Blau). Beide Datenquellen werden
 * getrennt übergeben — keine Typ-Vermischung.
 */
export function CalendarView({
  tasks,
  googleEvents = [],
}: {
  tasks: Task[];
  googleEvents?: GoogleEvent[];
}) {
  const initial = useMemo(() => {
    const first = tasks.find((t) => t.due_date)?.due_date;
    const d = first ? new Date(first) : new Date();
    return { y: d.getFullYear(), m: d.getMonth() };
  }, [tasks]);
  const [cursor, setCursor] = useState(initial);

  // ── Indexe für schnellen Zugriff ────────────────────────────────────
  const crmByDate = useMemo(() => {
    const map = new Map<string, Task[]>();
    for (const t of tasks) {
      if (!t.due_date) continue;
      const key = t.due_date.slice(0, 10);
      const arr = map.get(key) ?? [];
      arr.push(t);
      map.set(key, arr);
    }
    return map;
  }, [tasks]);

  const googleByDate = useMemo(() => {
    const map = new Map<string, GoogleEvent[]>();
    for (const e of googleEvents) {
      const key = googleEventDate(e);
      if (!key) continue;
      const arr = map.get(key) ?? [];
      arr.push(e);
      map.set(key, arr);
    }
    return map;
  }, [googleEvents]);

  const todayStr = ymd(new Date());

  // ── 6-Wochen-Raster (Montag-Start) ─────────────────────────────────
  const firstOfMonth = new Date(cursor.y, cursor.m, 1);
  const offset = (firstOfMonth.getDay() + 6) % 7; // Mo=0
  const cells: Date[] = [];
  for (let i = 0; i < 42; i++) {
    cells.push(new Date(cursor.y, cursor.m, 1 - offset + i));
  }

  function shift(delta: number) {
    const d = new Date(cursor.y, cursor.m + delta, 1);
    setCursor({ y: d.getFullYear(), m: d.getMonth() });
  }

  // ── Monats-Agenda (Liste unter dem Raster) ──────────────────────────
  const monthCrmTasks = tasks
    .filter((t) => {
      if (!t.due_date) return false;
      const d = new Date(t.due_date);
      return d.getMonth() === cursor.m && d.getFullYear() === cursor.y;
    })
    .sort((a, b) => (a.due_date ?? "").localeCompare(b.due_date ?? ""));

  const monthGoogleEvents = googleEvents
    .filter((e) => {
      const date = googleEventDate(e);
      if (!date) return false;
      const d = new Date(date);
      return d.getMonth() === cursor.m && d.getFullYear() === cursor.y;
    })
    .sort((a, b) => {
      const da = a.start.dateTime ?? a.start.date ?? "";
      const db = b.start.dateTime ?? b.start.date ?? "";
      return da.localeCompare(db);
    });

  const hasGoogleEvents = googleEvents.length > 0;

  return (
    <div className="space-y-4">
      {/* ── Monats-Grid ─────────────────────────────────────────────── */}
      <Card>
        <CardBody>
          {/* Header: Monat/Jahr + Navigation */}
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-ink">
                {MONTHS[cursor.m]} {cursor.y}
              </h2>
              {/* Legende nur wenn Google-Events vorhanden */}
              {hasGoogleEvents && (
                <span className="flex items-center gap-1 rounded-full border border-border bg-elevated/60 px-2 py-0.5 text-[0.65rem] text-faint">
                  <span className={cn("h-1.5 w-1.5 rounded-full", GOOGLE_DOT)} />
                  Google
                </span>
              )}
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => shift(-1)}
                className="rounded-lg border border-border px-2 py-1 text-sm text-muted hover:bg-elevated"
                aria-label="Vorheriger Monat"
              >
                ‹
              </button>
              <button
                onClick={() =>
                  setCursor({
                    y: new Date().getFullYear(),
                    m: new Date().getMonth(),
                  })
                }
                className="rounded-lg border border-border px-2.5 py-1 text-xs font-medium text-muted hover:bg-elevated"
              >
                Heute
              </button>
              <button
                onClick={() => shift(1)}
                className="rounded-lg border border-border px-2 py-1 text-sm text-muted hover:bg-elevated"
                aria-label="Nächster Monat"
              >
                ›
              </button>
            </div>
          </div>

          {/* Wochentage-Header */}
          <div className="grid grid-cols-7 gap-px overflow-hidden rounded-xl border border-border bg-border text-center">
            {WEEKDAYS.map((w) => (
              <div
                key={w}
                className="bg-elevated/60 py-1.5 text-[0.7rem] font-medium text-faint"
              >
                {w}
              </div>
            ))}

            {/* Tages-Zellen */}
            {cells.map((d, i) => {
              const inMonth = d.getMonth() === cursor.m;
              const key = ymd(d);
              const crmItems = crmByDate.get(key) ?? [];
              const gItems = googleByDate.get(key) ?? [];
              const totalItems = crmItems.length + gItems.length;
              const isToday = key === todayStr;

              return (
                <div
                  key={i}
                  className={cn(
                    "min-h-[4.5rem] bg-surface p-1 text-left align-top",
                    !inMonth && "bg-elevated/30"
                  )}
                >
                  {/* Tageszahl */}
                  <span
                    className={cn(
                      "inline-flex h-5 w-5 items-center justify-center rounded-full text-xs",
                      isToday
                        ? "bg-brand font-bold text-white"
                        : inMonth
                        ? "text-muted"
                        : "text-faint"
                    )}
                  >
                    {d.getDate()}
                  </span>

                  {/* Events: CRM zuerst, dann Google */}
                  <div className="mt-0.5 space-y-0.5">
                    {/* CRM-Tasks (max. 2 anzeigen wenn auch Google-Events da) */}
                    {crmItems
                      .slice(0, gItems.length > 0 ? 2 : 3)
                      .map((t) => (
                        <Link
                          key={t.id}
                          href={relatedHref(t.related_type, t.related_id) ?? "/cockpit/aufgaben"}
                          title={`${t.due_time ? `${t.due_time} · ` : ""}${t.title}${t.related_label ? ` · ${t.related_label}` : ""}`}
                          className={cn(
                            "flex items-center gap-1 truncate rounded px-1 py-0.5 text-[0.65rem] transition-colors hover:bg-elevated",
                            t.done ? "text-faint line-through" : "text-ink"
                          )}
                        >
                          <span
                            className={cn(
                              "h-1.5 w-1.5 flex-none rounded-full",
                              crmDotColor[t.related_type]
                            )}
                          />
                          <span className="truncate">
                            {t.due_time ? `${t.due_time} ` : ""}
                            {t.title}
                          </span>
                        </Link>
                      ))}

                    {/* Google-Events */}
                    {gItems.slice(0, 1).map((e) => {
                      const gt = googleEventTime(e);
                      const gTitle = `${gt ? `${gt} · ` : ""}${e.summary ?? "Termin"}`;
                      const gCls =
                        "flex items-center gap-1 truncate rounded px-1 py-0.5 text-[0.65rem] text-ink transition-colors hover:bg-elevated";
                      const gInner = (
                        <>
                          <span className={cn("h-1.5 w-1.5 flex-none rounded-full", GOOGLE_DOT)} />
                          <span className="truncate">
                            {gt ? `${gt} ` : ""}
                            {e.summary}
                          </span>
                        </>
                      );
                      return e.htmlLink ? (
                        <a
                          key={e.id}
                          href={e.htmlLink}
                          target="_blank"
                          rel="noopener noreferrer"
                          title={gTitle}
                          className={gCls}
                        >
                          {gInner}
                        </a>
                      ) : (
                        <div key={e.id} title={gTitle} className={cn(gCls, "cursor-default")}>
                          {gInner}
                        </div>
                      );
                    })}

                    {/* Overflow-Zähler */}
                    {totalItems > 3 && (
                      <div className="px-1 text-[0.6rem] text-faint">
                        +{totalItems - 3}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </CardBody>
      </Card>

      {/* ── Monats-Agenda ───────────────────────────────────────────── */}
      {(monthCrmTasks.length > 0 || monthGoogleEvents.length > 0) && (
        <Card>
          <CardBody>
            <p className="kpi-label mb-3">
              Agenda · {MONTHS[cursor.m]}
            </p>
            <ul className="divide-y divide-border">
              {/* CRM-Tasks */}
              {monthCrmTasks.map((t) => {
                const href = relatedHref(t.related_type, t.related_id);
                return (
                  <li key={t.id} className="flex items-center gap-3 py-2.5">
                    <span
                      className={cn(
                        "h-2 w-2 flex-none rounded-full",
                        crmDotColor[t.related_type]
                      )}
                    />
                    <div className="min-w-0 flex-1">
                      <p
                        className={cn(
                          "truncate text-sm font-medium",
                          t.done ? "text-faint line-through" : "text-ink"
                        )}
                      >
                        {t.title}
                      </p>
                      <p className="truncate text-xs text-faint">
                        {t.due_date?.slice(8, 10)}.
                        {t.due_date?.slice(5, 7)}.
                        {t.due_time ? ` ${t.due_time}` : ""}
                        {t.related_label ? ` · ${t.related_label}` : ""}
                      </p>
                    </div>
                    {href ? (
                      <Link
                        href={href}
                        className="flex-none text-faint hover:text-brand-deep"
                        aria-label="Zum Datensatz"
                      >
                        <IconChevronRight size={16} />
                      </Link>
                    ) : null}
                  </li>
                );
              })}

              {/* Google-Events */}
              {monthGoogleEvents.map((e) => {
                const date = googleEventDate(e);
                const time = googleEventTime(e);
                return (
                  <li key={e.id} className="flex items-center gap-3 py-2.5">
                    <span
                      className={cn(
                        "h-2 w-2 flex-none rounded-full",
                        GOOGLE_DOT
                      )}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-ink">
                        {e.summary}
                      </p>
                      <p className="truncate text-xs text-faint">
                        {date
                          ? `${date.slice(8, 10)}.${date.slice(5, 7)}.`
                          : ""}
                        {time ? ` ${time}` : ""}
                        <span className="ml-1.5 inline-flex items-center gap-1 rounded-full bg-[#4285F4]/10 px-1.5 py-px text-[0.6rem] font-medium text-[#4285F4]">
                          Google
                        </span>
                      </p>
                    </div>
                    {e.htmlLink ? (
                      <a
                        href={e.htmlLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex-none text-faint hover:text-[#4285F4]"
                        aria-label="In Google Kalender öffnen"
                      >
                        <IconChevronRight size={16} />
                      </a>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          </CardBody>
        </Card>
      )}
    </div>
  );
}
