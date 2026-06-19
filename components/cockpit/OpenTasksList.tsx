"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Card, CardBody } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { IconCheck, IconChevronRight } from "@/components/ui/icons";
import { cn } from "@/components/ui/cn";
import { formatDate } from "@/lib/format";
import { setTaskDone } from "@/lib/crm-actions";
import { toast } from "@/lib/toast";
import type { Task } from "@/lib/tasks-data";
import { relatedHref } from "@/lib/task-link";

function bucketOf(due: string | null): "overdue" | "today" | "upcoming" | "none" {
  if (!due) return "none";
  const d = new Date(due);
  d.setHours(0, 0, 0, 0);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  if (d < today) return "overdue";
  if (d.getTime() === today.getTime()) return "today";
  return "upcoming";
}

const GROUPS: { key: "overdue" | "today" | "upcoming" | "none"; label: string }[] = [
  { key: "overdue", label: "Überfällig" },
  { key: "today", label: "Heute" },
  { key: "upcoming", label: "Demnächst" },
  { key: "none", label: "Ohne Datum" },
];

export function OpenTasksList({ tasks }: { tasks: Task[] }) {
  const router = useRouter();
  const [items, setItems] = useState<Task[]>(tasks);
  const [, start] = useTransition();

  function complete(t: Task) {
    const prev = items;
    setItems((p) => p.filter((x) => x.id !== t.id));
    start(async () => {
      const res = await setTaskDone(t.id, true);
      if (res.ok && !res.demo) router.refresh();
      else if (!res.ok) {
        setItems(prev); // fehlgeschlagen → Aufgabe wiederherstellen
        if (res.error) toast.error(res.error);
      }
    });
  }

  if (items.length === 0) {
    return (
      <Card>
        <CardBody>
          <EmptyState title="Keine offenen Aufgaben. Stark – alles abgearbeitet." />
        </CardBody>
      </Card>
    );
  }

  return (
    <div className="space-y-5">
      {GROUPS.map(({ key, label }) => {
        const group = items.filter((t) => bucketOf(t.due_date) === key);
        if (group.length === 0) return null;
        return (
          <div key={key}>
            <p
              className={cn(
                "kpi-label mb-2",
                key === "overdue" ? "text-danger" : key === "today" ? "text-brand-deep" : "text-faint"
              )}
            >
              {label} · {group.length}
            </p>
            <Card>
              <CardBody className="p-0 sm:p-0">
                <ul className="divide-y divide-border">
                  {group.map((t) => (
                    <li key={t.id} className="flex items-center gap-3 px-4 py-3">
                      <button
                        type="button"
                        aria-label="Als erledigt markieren"
                        onClick={() => complete(t)}
                        className="flex h-5 w-5 flex-none items-center justify-center rounded-md border border-border bg-surface text-transparent hover:border-success hover:text-success"
                      >
                        <IconCheck size={13} />
                      </button>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-ink">{t.title}</p>
                        <p className="truncate text-xs text-faint">
                          {t.due_date ? `fällig ${formatDate(t.due_date)}${t.due_time ? ` ${t.due_time}` : ""}` : "ohne Datum"}
                          {t.related_label ? ` · ${t.related_label}` : ""}
                        </p>
                      </div>
                      {relatedHref(t.related_type, t.related_id) ? (
                        <Link
                          href={relatedHref(t.related_type, t.related_id)!}
                          className="flex-none text-faint hover:text-brand-deep"
                          aria-label="Zum Datensatz"
                        >
                          <IconChevronRight size={16} />
                        </Link>
                      ) : null}
                    </li>
                  ))}
                </ul>
              </CardBody>
            </Card>
          </div>
        );
      })}
    </div>
  );
}
