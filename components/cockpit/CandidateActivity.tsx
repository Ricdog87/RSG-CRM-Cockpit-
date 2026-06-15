"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Card, CardBody } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { cn } from "@/components/ui/cn";
import { IconMail, IconCheck, IconTrash, IconPencil, IconTasks } from "@/components/ui/icons";
import { formatDate } from "@/lib/format";
import {
  addCandidateNote,
  deleteCandidateNote,
  addTask,
  setTaskDone,
  deleteTask,
} from "@/lib/crm-actions";
import type { Note } from "@/lib/notes-data";
import type { Task } from "@/lib/tasks-data";
import type { EmailActivity } from "@/lib/email-data";

type Tab = "alle" | "notizen" | "aufgaben" | "emails";

const TABS: { key: Tab; label: string }[] = [
  { key: "alle", label: "Alle" },
  { key: "notizen", label: "Notizen" },
  { key: "aufgaben", label: "Aufgaben" },
  { key: "emails", label: "E-Mails" },
];

function isOverdue(due: string | null): boolean {
  if (!due) return false;
  const d = new Date(due);
  const t = new Date();
  t.setHours(0, 0, 0, 0);
  return d < t;
}

/**
 * Aktivitäts-Center der Kandidaten-Detailmaske (HubSpot-Vorbild):
 * Notizen + Aufgaben anlegen, E-Mail-Verlauf, alles als gefilterte Timeline.
 */
export function CandidateActivity({
  candidateId,
  candidateName,
  notes,
  tasks,
  emails,
}: {
  candidateId: string;
  candidateName: string;
  notes: Note[];
  tasks: Task[];
  emails: EmailActivity[];
}) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("alle");
  const [noteItems, setNoteItems] = useState<Note[]>(notes);
  const [taskItems, setTaskItems] = useState<Task[]>(tasks);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const noteRef = useRef<HTMLTextAreaElement>(null);
  const taskRef = useRef<HTMLInputElement>(null);
  const dueRef = useRef<HTMLInputElement>(null);

  function saveNote() {
    const body = noteRef.current?.value.trim();
    if (!body) return;
    setError(null);
    const optimistic: Note = { id: `tmp-${Date.now()}`, body, created_at: new Date().toISOString() };
    setNoteItems((p) => [optimistic, ...p]);
    if (noteRef.current) noteRef.current.value = "";
    start(async () => {
      const res = await addCandidateNote(candidateId, body);
      if (res.ok && !res.demo) router.refresh();
      else if (!res.ok) {
        setNoteItems((p) => p.filter((n) => n.id !== optimistic.id));
        setError(res.error ?? "Notiz fehlgeschlagen.");
      }
    });
  }

  function removeNote(id: string) {
    setNoteItems((p) => p.filter((n) => n.id !== id));
    start(async () => {
      const res = await deleteCandidateNote(id, candidateId);
      if (res.ok && !res.demo) router.refresh();
    });
  }

  function addTaskItem() {
    const title = taskRef.current?.value.trim();
    if (!title) return;
    setError(null);
    const due = dueRef.current?.value || null;
    const optimistic: Task = {
      id: `tmp-${Date.now()}`,
      related_type: "candidate",
      related_id: candidateId,
      related_label: candidateName,
      title,
      notes: null,
      due_date: due,
      due_time: null,
      done: false,
    };
    setTaskItems((p) => [optimistic, ...p]);
    if (taskRef.current) taskRef.current.value = "";
    if (dueRef.current) dueRef.current.value = "";
    start(async () => {
      const res = await addTask({
        related_type: "candidate",
        related_id: candidateId,
        related_label: candidateName,
        title,
        due_date: due,
      });
      if (res.ok && !res.demo) router.refresh();
      else if (!res.ok) {
        setTaskItems((p) => p.filter((t) => t.id !== optimistic.id));
        setError(res.error ?? "Aufgabe fehlgeschlagen.");
      }
    });
  }

  function toggleTask(t: Task) {
    setTaskItems((p) => p.map((x) => (x.id === t.id ? { ...x, done: !x.done } : x)));
    start(async () => {
      const res = await setTaskDone(t.id, !t.done);
      if (res.ok && !res.demo) router.refresh();
    });
  }

  function removeTask(id: string) {
    setTaskItems((p) => p.filter((t) => t.id !== id));
    start(async () => {
      const res = await deleteTask(id);
      if (res.ok && !res.demo) router.refresh();
    });
  }

  const showNotes = tab === "alle" || tab === "notizen";
  const showTasks = tab === "alle" || tab === "aufgaben";
  const showEmails = tab === "alle" || tab === "emails";

  // Vereinte, chronologische Timeline für „Alle".
  type Feed =
    | { kind: "note"; at: string; node: React.ReactNode }
    | { kind: "task"; at: string; node: React.ReactNode }
    | { kind: "email"; at: string; node: React.ReactNode };

  const feed: Feed[] = [];
  if (showNotes) noteItems.forEach((n) => feed.push({ kind: "note", at: n.created_at, node: renderNote(n) }));
  if (showTasks) taskItems.forEach((t) => feed.push({ kind: "task", at: t.due_date ?? "", node: renderTask(t) }));
  if (showEmails) emails.forEach((e) => feed.push({ kind: "email", at: e.occurred_at, node: renderEmail(e) }));
  feed.sort((a, b) => (b.at || "").localeCompare(a.at || ""));

  function renderNote(n: Note) {
    return (
      <div className="group flex items-start gap-3">
        <span className="mt-0.5 flex h-7 w-7 flex-none items-center justify-center rounded-full bg-brand/10 text-brand-deep">
          <IconPencil size={14} />
        </span>
        <div className="min-w-0 flex-1 rounded-xl border border-border bg-elevated/40 px-3 py-2.5">
          <p className="whitespace-pre-line text-sm text-ink">{n.body}</p>
          <p className="mt-1 text-[0.7rem] text-faint">Notiz · {formatDate(n.created_at)}</p>
        </div>
        <button
          type="button"
          aria-label="Notiz löschen"
          onClick={() => removeNote(n.id)}
          className="mt-1 flex-none rounded-lg p-1.5 text-faint opacity-0 transition-opacity hover:bg-danger/10 hover:text-danger group-hover:opacity-100"
        >
          <IconTrash size={14} />
        </button>
      </div>
    );
  }

  function renderTask(t: Task) {
    return (
      <div className="group flex items-start gap-3">
        <button
          type="button"
          aria-label={t.done ? "Als offen markieren" : "Als erledigt markieren"}
          onClick={() => toggleTask(t)}
          className={cn(
            "mt-0.5 flex h-7 w-7 flex-none items-center justify-center rounded-full border",
            t.done
              ? "border-success bg-success text-white"
              : "border-border bg-surface text-transparent hover:border-brand"
          )}
        >
          <IconCheck size={14} />
        </button>
        <div className="min-w-0 flex-1 rounded-xl border border-border bg-elevated/40 px-3 py-2.5">
          <p className={cn("text-sm", t.done ? "text-faint line-through" : "text-ink")}>{t.title}</p>
          <p
            className={cn(
              "mt-1 text-[0.7rem]",
              !t.done && isOverdue(t.due_date) ? "font-medium text-danger" : "text-faint"
            )}
          >
            Aufgabe{t.due_date ? ` · fällig ${formatDate(t.due_date)}` : ""}
          </p>
        </div>
        <button
          type="button"
          aria-label="Aufgabe löschen"
          onClick={() => removeTask(t.id)}
          className="mt-1 flex-none rounded-lg p-1.5 text-faint opacity-0 transition-opacity hover:bg-danger/10 hover:text-danger group-hover:opacity-100"
        >
          <IconTrash size={14} />
        </button>
      </div>
    );
  }

  function renderEmail(e: EmailActivity) {
    return (
      <div className="flex items-start gap-3">
        <span className="mt-0.5 flex h-7 w-7 flex-none items-center justify-center rounded-full bg-sky/10 text-sky-deep">
          <IconMail size={14} />
        </span>
        <div className="min-w-0 flex-1 rounded-xl border border-border bg-elevated/40 px-3 py-2.5">
          <p className="truncate text-sm font-medium text-ink">{e.subject}</p>
          {e.snippet ? <p className="mt-0.5 line-clamp-2 text-xs text-muted">{e.snippet}</p> : null}
          <p className="mt-1 text-[0.7rem] text-faint">
            {e.direction === "inbound" ? "Eingang" : "Ausgang"} · {formatDate(e.occurred_at)}
          </p>
        </div>
      </div>
    );
  }

  return (
    <Card>
      <CardBody className="space-y-4">
        {/* Tabs */}
        <div className="flex gap-1 border-b border-border">
          {TABS.map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => setTab(t.key)}
              className={cn(
                "-mb-px border-b-2 px-3 py-2 text-sm font-medium transition-colors",
                tab === t.key
                  ? "border-brand text-brand-deep"
                  : "border-transparent text-muted hover:text-ink"
              )}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Composer (kontextabhängig) */}
        {tab !== "emails" ? (
          tab === "aufgaben" ? (
            <div className="flex flex-wrap gap-2">
              <input
                ref={taskRef}
                placeholder="Aufgabe …"
                onKeyDown={(e) => e.key === "Enter" && addTaskItem()}
                className="min-w-0 flex-1 rounded-xl border border-border bg-surface px-3 py-2 text-sm text-ink placeholder:text-faint focus-visible:ring-2 focus-visible:ring-brand"
              />
              <input
                ref={dueRef}
                type="date"
                className="rounded-xl border border-border bg-surface px-3 py-2 text-sm text-muted focus-visible:ring-2 focus-visible:ring-brand"
              />
              <Button onClick={addTaskItem} disabled={pending}>
                <IconTasks size={15} /> Aufgabe
              </Button>
            </div>
          ) : (
            <div className="space-y-2">
              <textarea
                ref={noteRef}
                rows={2}
                placeholder="Notiz hinzufügen …"
                onKeyDown={(e) => {
                  if ((e.metaKey || e.ctrlKey) && e.key === "Enter") saveNote();
                }}
                className="w-full rounded-xl border border-border bg-surface px-3 py-2 text-sm text-ink placeholder:text-faint focus-visible:ring-2 focus-visible:ring-brand"
              />
              <div className="flex justify-end">
                <Button onClick={saveNote} disabled={pending}>
                  <IconPencil size={15} /> Notiz speichern
                </Button>
              </div>
            </div>
          )
        ) : null}

        {error ? (
          <p className="rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-xs text-danger">
            {error}
          </p>
        ) : null}

        {/* Timeline */}
        {feed.length === 0 ? (
          <EmptyState
            title={
              tab === "emails"
                ? "Noch keine getrackten E-Mails zu dieser Person."
                : "Noch keine Aktivität. Halte den nächsten Schritt fest."
            }
          />
        ) : (
          <ul className="space-y-2.5">
            {feed.map((f, i) => (
              <li key={i}>{f.node}</li>
            ))}
          </ul>
        )}
      </CardBody>
    </Card>
  );
}
