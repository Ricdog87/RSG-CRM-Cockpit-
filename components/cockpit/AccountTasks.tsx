"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Card, CardBody, SectionHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { IconCheck, IconTrash } from "@/components/ui/icons";
import { cn } from "@/components/ui/cn";
import { formatDate } from "@/lib/format";
import { addTask, setTaskDone, deleteTask } from "@/lib/crm-actions";
import type { Task } from "@/lib/tasks-data";

function isOverdue(due: string | null): boolean {
  if (!due) return false;
  const d = new Date(due);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return d < today;
}

export function AccountTasks({
  accountId,
  accountName,
  tasks,
}: {
  accountId: string;
  accountName: string;
  tasks: Task[];
}) {
  const router = useRouter();
  const [items, setItems] = useState<Task[]>(tasks);
  useEffect(() => setItems(tasks), [tasks]);
  const [pending, start] = useTransition();
  const titleRef = useRef<HTMLInputElement>(null);
  const dueRef = useRef<HTMLInputElement>(null);

  function refresh(res: { ok: boolean; demo?: boolean; redirect?: string }) {
    if (res.ok && !res.demo) {
      if (res.redirect) router.replace(res.redirect);
      else router.refresh();
    }
  }

  function add() {
    const title = titleRef.current?.value.trim();
    if (!title) return;
    const due = dueRef.current?.value || null;
    const optimistic: Task = {
      id: `tmp-${Date.now()}`,
      related_type: "customer",
      related_id: accountId,
      related_label: accountName,
      title,
      notes: null,
      due_date: due,
      due_time: null,
      done: false,
    };
    setItems((p) => [optimistic, ...p]);
    if (titleRef.current) titleRef.current.value = "";
    if (dueRef.current) dueRef.current.value = "";
    start(async () =>
      refresh(
        await addTask({
          related_type: "customer",
          related_id: accountId,
          related_label: accountName,
          title,
          due_date: due,
        })
      )
    );
  }

  function toggle(t: Task) {
    setItems((p) => p.map((x) => (x.id === t.id ? { ...x, done: !x.done } : x)));
    start(async () => refresh(await setTaskDone(t.id, !t.done)));
  }

  function remove(id: string) {
    setItems((p) => p.filter((x) => x.id !== id));
    start(async () => refresh(await deleteTask(id)));
  }

  const sorted = [...items].sort(
    (a, b) =>
      Number(a.done) - Number(b.done) ||
      (a.due_date ?? "9999").localeCompare(b.due_date ?? "9999")
  );

  return (
    <Card>
      <CardBody>
        <SectionHeader title="Aufgaben" hint="nächste Schritte mit Fälligkeit" />

        <div className="mb-4 flex flex-wrap gap-2">
          <input
            ref={titleRef}
            placeholder="Aufgabe …"
            onKeyDown={(e) => e.key === "Enter" && add()}
            className="min-w-0 flex-1 rounded-xl border border-border bg-surface px-3 py-2 text-sm text-ink placeholder:text-faint focus-visible:ring-2 focus-visible:ring-brand"
          />
          <input
            ref={dueRef}
            type="date"
            className="rounded-xl border border-border bg-surface px-3 py-2 text-sm text-muted focus-visible:ring-2 focus-visible:ring-brand"
          />
          <Button onClick={add} disabled={pending}>
            Hinzufügen
          </Button>
        </div>

        {sorted.length === 0 ? (
          <EmptyState title="Keine Aufgaben. Lege den nächsten Schritt für diesen Kunden an." />
        ) : (
          <ul className="space-y-1.5">
            {sorted.map((t) => (
              <li
                key={t.id}
                className="group flex items-center gap-3 rounded-xl border border-border bg-elevated/40 px-3 py-2.5"
              >
                <button
                  type="button"
                  aria-label={t.done ? "Als offen markieren" : "Als erledigt markieren"}
                  onClick={() => toggle(t)}
                  className={cn(
                    "flex h-5 w-5 flex-none items-center justify-center rounded-md border",
                    t.done
                      ? "border-success bg-success text-white"
                      : "border-border bg-surface text-transparent hover:border-brand"
                  )}
                >
                  <IconCheck size={13} />
                </button>
                <div className="min-w-0 flex-1">
                  <p className={cn("truncate text-sm", t.done ? "text-faint line-through" : "text-ink")}>
                    {t.title}
                  </p>
                  {t.due_date ? (
                    <p
                      className={cn(
                        "text-[0.7rem]",
                        !t.done && isOverdue(t.due_date) ? "font-medium text-danger" : "text-faint"
                      )}
                    >
                      fällig {formatDate(t.due_date)}
                      {t.due_time ? ` · ${t.due_time}` : ""}
                    </p>
                  ) : null}
                </div>
                <button
                  type="button"
                  aria-label="Aufgabe löschen"
                  onClick={() => remove(t.id)}
                  className="flex-none rounded-lg p-1.5 text-faint opacity-0 transition-opacity hover:bg-danger/10 hover:text-danger group-hover:opacity-100"
                >
                  <IconTrash size={15} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </CardBody>
    </Card>
  );
}
