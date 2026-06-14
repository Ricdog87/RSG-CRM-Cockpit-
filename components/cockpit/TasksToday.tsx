import Link from "next/link";
import { Card, CardBody, SectionHeader } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { IconChevronRight, IconTasks } from "@/components/ui/icons";
import { formatDate } from "@/lib/format";
import type { Task } from "@/lib/tasks-data";

function dueBucket(due: string | null): "overdue" | "today" | "later" {
  if (!due) return "later";
  const d = new Date(due);
  d.setHours(0, 0, 0, 0);
  const t = new Date();
  t.setHours(0, 0, 0, 0);
  if (d < t) return "overdue";
  if (d.getTime() === t.getTime()) return "today";
  return "later";
}

/** Kompaktes „Heute fällig"-Widget für die Übersicht. */
export function TasksToday({ tasks }: { tasks: Task[] }) {
  const due = tasks
    .filter((t) => dueBucket(t.due_date) !== "later")
    .sort((a, b) => (a.due_date ?? "").localeCompare(b.due_date ?? ""))
    .slice(0, 5);
  const overdue = tasks.filter((t) => dueBucket(t.due_date) === "overdue").length;

  return (
    <Card>
      <CardBody>
        <SectionHeader
          title="Aufgaben heute"
          action={
            <Link
              href="/cockpit/aufgaben"
              className="inline-flex items-center gap-1 text-xs font-semibold text-sky-deep hover:text-sky-ink"
            >
              Alle <IconChevronRight size={14} />
            </Link>
          }
        />
        {due.length === 0 ? (
          <EmptyState
            title="Heute nichts fällig. Plane deinen nächsten Schritt je Kunde."
            icon={<IconTasks size={22} />}
          />
        ) : (
          <ul className="space-y-2">
            {overdue > 0 ? (
              <li>
                <Badge tone="danger">{overdue} überfällig</Badge>
              </li>
            ) : null}
            {due.map((t) => (
              <li
                key={t.id}
                className="flex items-center justify-between gap-3 rounded-xl border border-border bg-elevated/40 px-3 py-2"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-ink">{t.title}</p>
                  <p className="truncate text-xs text-faint">
                    {t.account_name}
                    {t.due_date ? ` · fällig ${formatDate(t.due_date)}` : ""}
                  </p>
                </div>
                {t.account_id ? (
                  <Link
                    href={`/cockpit/kunden/${t.account_id}`}
                    className="flex-none text-faint hover:text-brand-deep"
                    aria-label="Zum Account"
                  >
                    <IconChevronRight size={16} />
                  </Link>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </CardBody>
    </Card>
  );
}
