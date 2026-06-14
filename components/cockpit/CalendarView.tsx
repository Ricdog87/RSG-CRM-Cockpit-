"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Card, CardBody } from "@/components/ui/Card";
import { IconChevronRight } from "@/components/ui/icons";
import { cn } from "@/components/ui/cn";
import { relatedHref, type RelatedType } from "@/lib/task-link";
import type { Task } from "@/lib/tasks-data";

const WEEKDAYS = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];
const MONTHS = ["Januar", "Februar", "März", "April", "Mai", "Juni", "Juli", "August", "September", "Oktober", "November", "Dezember"];

const dotColor: Record<RelatedType, string> = {
  customer: "bg-brand",
  candidate: "bg-sky",
  project: "bg-success",
  none: "bg-faint",
};

function ymd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function CalendarView({ tasks }: { tasks: Task[] }) {
  const initial = useMemo(() => {
    const first = tasks.find((t) => t.due_date)?.due_date;
    const d = first ? new Date(first) : new Date();
    return { y: d.getFullYear(), m: d.getMonth() };
  }, [tasks]);
  const [cursor, setCursor] = useState(initial);

  const byDate = useMemo(() => {
    const map = new Map<string, Task[]>();
    for (const t of tasks) {
      if (!t.due_date) continue;
      const key = t.due_date.slice(0, 10);
      (map.get(key) ?? map.set(key, []).get(key)!).push(t);
    }
    return map;
  }, [tasks]);

  const todayStr = ymd(new Date());

  // 6-Wochen-Raster (Montag-Start).
  const firstOfMonth = new Date(cursor.y, cursor.m, 1);
  const offset = (firstOfMonth.getDay() + 6) % 7;
  const cells: Date[] = [];
  for (let i = 0; i < 42; i++) {
    cells.push(new Date(cursor.y, cursor.m, 1 - offset + i));
  }

  function shift(delta: number) {
    const d = new Date(cursor.y, cursor.m + delta, 1);
    setCursor({ y: d.getFullYear(), m: d.getMonth() });
  }

  const monthTasks = tasks
    .filter((t) => t.due_date && new Date(t.due_date).getMonth() === cursor.m && new Date(t.due_date).getFullYear() === cursor.y)
    .sort((a, b) => (a.due_date ?? "").localeCompare(b.due_date ?? ""));

  return (
    <div className="space-y-4">
      <Card>
        <CardBody>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-base font-bold text-ink">
              {MONTHS[cursor.m]} {cursor.y}
            </h2>
            <div className="flex items-center gap-1">
              <button onClick={() => shift(-1)} className="rounded-lg border border-border px-2 py-1 text-sm text-muted hover:bg-elevated" aria-label="Vorheriger Monat">‹</button>
              <button onClick={() => setCursor({ y: new Date().getFullYear(), m: new Date().getMonth() })} className="rounded-lg border border-border px-2.5 py-1 text-xs font-medium text-muted hover:bg-elevated">Heute</button>
              <button onClick={() => shift(1)} className="rounded-lg border border-border px-2 py-1 text-sm text-muted hover:bg-elevated" aria-label="Nächster Monat">›</button>
            </div>
          </div>

          <div className="grid grid-cols-7 gap-px overflow-hidden rounded-xl border border-border bg-border text-center">
            {WEEKDAYS.map((w) => (
              <div key={w} className="bg-elevated/60 py-1.5 text-[0.7rem] font-medium text-faint">{w}</div>
            ))}
            {cells.map((d, i) => {
              const inMonth = d.getMonth() === cursor.m;
              const key = ymd(d);
              const items = byDate.get(key) ?? [];
              const isToday = key === todayStr;
              return (
                <div
                  key={i}
                  className={cn(
                    "min-h-[4.5rem] bg-surface p-1 text-left align-top",
                    !inMonth && "bg-elevated/30"
                  )}
                >
                  <span
                    className={cn(
                      "inline-flex h-5 w-5 items-center justify-center rounded-full text-xs",
                      isToday ? "bg-brand text-white font-bold" : inMonth ? "text-muted" : "text-faint"
                    )}
                  >
                    {d.getDate()}
                  </span>
                  <div className="mt-0.5 space-y-0.5">
                    {items.slice(0, 3).map((t) => (
                      <div key={t.id} className={cn("flex items-center gap-1 truncate rounded px-1 py-0.5 text-[0.65rem]", t.done ? "text-faint line-through" : "text-ink")}>
                        <span className={cn("h-1.5 w-1.5 flex-none rounded-full", dotColor[t.related_type])} />
                        <span className="truncate">{t.due_time ? `${t.due_time} ` : ""}{t.title}</span>
                      </div>
                    ))}
                    {items.length > 3 ? (
                      <div className="px-1 text-[0.6rem] text-faint">+{items.length - 3}</div>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        </CardBody>
      </Card>

      {monthTasks.length > 0 ? (
        <Card>
          <CardBody>
            <p className="kpi-label mb-2">Agenda · {MONTHS[cursor.m]}</p>
            <ul className="divide-y divide-border">
              {monthTasks.map((t) => {
                const href = relatedHref(t.related_type, t.related_id);
                return (
                  <li key={t.id} className="flex items-center gap-3 py-2.5">
                    <span className={cn("h-2 w-2 flex-none rounded-full", dotColor[t.related_type])} />
                    <div className="min-w-0 flex-1">
                      <p className={cn("truncate text-sm font-medium", t.done ? "text-faint line-through" : "text-ink")}>{t.title}</p>
                      <p className="truncate text-xs text-faint">
                        {t.due_date?.slice(8, 10)}.{t.due_date?.slice(5, 7)}.{t.due_time ? ` ${t.due_time}` : ""}
                        {t.related_label ? ` · ${t.related_label}` : ""}
                      </p>
                    </div>
                    {href ? (
                      <Link href={href} className="flex-none text-faint hover:text-brand-deep" aria-label="Zum Datensatz">
                        <IconChevronRight size={16} />
                      </Link>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          </CardBody>
        </Card>
      ) : null}
    </div>
  );
}
