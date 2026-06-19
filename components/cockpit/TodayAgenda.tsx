import Link from "next/link";
import { Card, CardBody, SectionHeader } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import {
  IconTasks,
  IconChevronRight,
  IconCalendar,
  IconPlus,
  IconAlertTriangle,
  IconClock,
} from "@/components/ui/icons";
import type { Task } from "@/lib/tasks-data";
import { relatedHref } from "@/lib/task-link";

function TimeBadge({ time }: { time: string | null }) {
  if (!time) return null;
  return (
    <span className="flex-none rounded-lg bg-surface px-1.5 py-0.5 font-mono text-[0.65rem] font-semibold text-muted tabular-nums">
      {time.slice(0, 5)}
    </span>
  );
}

function TaskRow({ task, tone }: { task: Task; tone: "overdue" | "today" | "soon" }) {
  const href = relatedHref(task.related_type, task.related_id);
  const rowBg =
    tone === "overdue"
      ? "border-danger/30 bg-danger/[0.05]"
      : "border-border/60 bg-elevated/40";

  return (
    <div className={`flex items-start gap-3 rounded-xl border px-3 py-2.5 ${rowBg}`}>
      <TimeBadge time={task.due_time} />
      <div className="min-w-0 flex-1">
        <p className={`truncate text-sm font-medium ${tone === "overdue" ? "text-danger" : "text-ink"}`}>
          {task.title}
        </p>
        {task.related_label ? (
          <p className="truncate text-xs text-faint">{task.related_label}</p>
        ) : null}
      </div>
      {href ? (
        <Link
          href={href}
          className="flex-none text-faint hover:text-brand-deep"
          aria-label="Zum Datensatz"
        >
          <IconChevronRight size={15} />
        </Link>
      ) : null}
    </div>
  );
}

function AgendaSection({
  label,
  icon,
  tasks,
  tone,
}: {
  label: string;
  icon: React.ReactNode;
  tasks: Task[];
  tone: "overdue" | "today" | "soon";
}) {
  if (tasks.length === 0) return null;
  const labelColor =
    tone === "overdue"
      ? "text-danger"
      : tone === "today"
      ? "text-warning"
      : "text-muted";

  return (
    <div className="space-y-1.5">
      <p className={`flex items-center gap-1 text-[0.7rem] font-semibold uppercase tracking-wide ${labelColor}`}>
        {icon}
        {label}
        <span className="ml-0.5 rounded-full bg-current/10 px-1.5 py-px font-bold tabular-nums">
          {tasks.length}
        </span>
      </p>
      <div className="space-y-1.5">
        {tasks.map((t) => (
          <TaskRow key={t.id} task={t} tone={tone} />
        ))}
      </div>
    </div>
  );
}

/** Tagesordnung-Widget: überfällige · heute · demnächst. */
export function TodayAgenda({ tasks }: { tasks: Task[] }) {
  const now = new Date();
  const todayStr = now.toISOString().split("T")[0];

  function bucket(t: Task): "overdue" | "today" | "soon" | "later" {
    if (!t.due_date) return "later";
    if (t.due_date < todayStr) return "overdue";
    if (t.due_date === todayStr) return "today";
    const diff =
      (new Date(t.due_date).getTime() - now.getTime()) / 86_400_000;
    return diff <= 3 ? "soon" : "later";
  }

  const open = tasks.filter((t) => !t.done);
  const overdue = open
    .filter((t) => bucket(t) === "overdue")
    .sort((a, b) => (a.due_date ?? "").localeCompare(b.due_date ?? ""));
  const today = open
    .filter((t) => bucket(t) === "today")
    .sort((a, b) =>
      (a.due_time ?? "99:99").localeCompare(b.due_time ?? "99:99")
    );
  const soon = open
    .filter((t) => bucket(t) === "soon")
    .sort((a, b) => (a.due_date ?? "").localeCompare(b.due_date ?? ""))
    .slice(0, 4);

  const dateLabel = now.toLocaleDateString("de-DE", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  const totalActive = overdue.length + today.length;

  return (
    <Card>
      <CardBody>
        <SectionHeader
          title={`Tagesordnung – ${dateLabel}`}
          action={
            <Link
              href="/cockpit/aufgaben"
              className="inline-flex items-center gap-1 text-xs font-semibold text-sky-deep hover:text-sky-ink"
            >
              Alle Aufgaben <IconChevronRight size={14} />
            </Link>
          }
        />

        {totalActive === 0 && soon.length === 0 ? (
          <EmptyState
            title="Kein offener Punkt für heute. Plane deinen nächsten Schritt."
            icon={<IconCalendar size={22} />}
          />
        ) : (
          <div className="space-y-4">
            <AgendaSection
              label="Überfällig"
              icon={<IconAlertTriangle size={12} />}
              tasks={overdue}
              tone="overdue"
            />
            <AgendaSection
              label="Heute"
              icon={<IconClock size={12} />}
              tasks={today}
              tone="today"
            />
            <AgendaSection
              label="Demnächst (3 Tage)"
              icon={<IconTasks size={12} />}
              tasks={soon}
              tone="soon"
            />
          </div>
        )}

        <div className="mt-4 border-t border-border/40 pt-3">
          <Link
            href="/cockpit/aufgaben"
            className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-elevated/40 px-3 py-1.5 text-xs font-medium text-muted transition-colors hover:bg-elevated hover:text-ink"
          >
            <IconPlus size={13} />
            Aufgabe hinzufügen
          </Link>
        </div>
      </CardBody>
    </Card>
  );
}
