"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Card, CardBody } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { cn } from "@/components/ui/cn";
import {
  IconMail,
  IconCheck,
  IconTrash,
  IconPencil,
  IconTasks,
  IconPhone,
  IconCalendar,
} from "@/components/ui/icons";
import { formatDate } from "@/lib/format";
import {
  addCandidateNote,
  deleteCandidateNote,
  addTask,
  setTaskDone,
  deleteTask,
} from "@/lib/crm-actions";
import type { CandidateNote, CandidateNoteKind } from "@/lib/notes-data";
import type { Task } from "@/lib/tasks-data";
import type { EmailActivity } from "@/lib/email-data";

type Tab = "alle" | "notizen" | "anrufe" | "meetings" | "aufgaben" | "emails";

const TABS: { key: Tab; label: string }[] = [
  { key: "alle", label: "Alle" },
  { key: "notizen", label: "Notizen" },
  { key: "anrufe", label: "Anrufe" },
  { key: "meetings", label: "Meetings" },
  { key: "aufgaben", label: "Aufgaben" },
  { key: "emails", label: "E-Mails" },
];

const KIND_META: Record<
  CandidateNoteKind,
  { label: string; icon: (p: { size?: number }) => JSX.Element; chip: string }
> = {
  note: { label: "Notiz", icon: IconPencil, chip: "bg-brand/10 text-brand-deep" },
  call: { label: "Anruf", icon: IconPhone, chip: "bg-success/10 text-success" },
  meeting: { label: "Meeting", icon: IconCalendar, chip: "bg-sky/10 text-sky-deep" },
};

function isOverdue(due: string | null): boolean {
  if (!due) return false;
  const d = new Date(due);
  const t = new Date();
  t.setHours(0, 0, 0, 0);
  return d < t;
}

/**
 * Aktivitäts-Center der Kandidaten-Detailmaske (HubSpot-Vorbild):
 * Notizen, Anrufe, Meetings & Aufgaben protokollieren, E-Mail-Verlauf,
 * alles als gefilterte Timeline.
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
  notes: CandidateNote[];
  tasks: Task[];
  emails: EmailActivity[];
}) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("alle");
  const [noteItems, setNoteItems] = useState<CandidateNote[]>(notes);
  const [taskItems, setTaskItems] = useState<Task[]>(tasks);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const noteRef = useRef<HTMLTextAreaElement>(null);
  const taskRef = useRef<HTMLInputElement>(null);
  const dueRef = useRef<HTMLInputElement>(null);

  // Welcher Eintragstyp wird im Composer protokolliert?
  const logKind: CandidateNoteKind =
    tab === "anrufe" ? "call" : tab === "meetings" ? "meeting" : "note";

  function saveNote() {
    const body = noteRef.current?.value.trim();
    if (!body) return;
    setError(null);
    const optimistic: CandidateNote = {
      id: `tmp-${Date.now()}`,
      body,
      created_at: new Date().toISOString(),
      kind: logKind,
    };
    setNoteItems((p) => [optimistic, ...p]);
    if (noteRef.current) noteRef.current.value = "";
    start(async () => {
      const res = await addCandidateNote(candidateId, body, logKind);
      if (res.ok && !res.demo) router.refresh();
      else if (!res.ok) {
        setNoteItems((p) => p.filter((n) => n.id !== optimistic.id));
        setError(res.error ?? "Eintrag fehlgeschlagen.");
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

  // Welche Notiz-Arten zeigt der aktive Tab?
  const noteKindFilter: CandidateNoteKind | null =
    tab === "notizen" ? "note" : tab === "anrufe" ? "call" : tab === "meetings" ? "meeting" : null;
  const showNotes = tab === "alle" || noteKindFilter !== null;
  const showTasks = tab === "alle" || tab === "aufgaben";
  const showEmails = tab === "alle" || tab === "emails";

  type Feed = { at: string; node: React.ReactNode };
  const feed: Feed[] = [];
  if (showNotes) {
    noteItems
      .filter((n) => (noteKindFilter ? n.kind === noteKindFilter : true))
      .forEach((n) => feed.push({ at: n.created_at, node: renderNote(n) }));
  }
  if (showTasks) taskItems.forEach((t) => feed.push({ at: t.due_date ?? "", node: renderTask(t) }));
  if (showEmails) {
    // Mail-Tracking übersichtlich halten: nur die letzten 5 E-Mails.
    const recentEmails = [...emails]
      .sort((a, b) => (b.occurred_at || "").localeCompare(a.occurred_at || ""))
      .slice(0, 5);
    recentEmails.forEach((e) => feed.push({ at: e.occurred_at, node: renderEmail(e) }));
  }
  feed.sort((a, b) => (b.at || "").localeCompare(a.at || ""));

  function renderNote(n: CandidateNote) {
    const meta = KIND_META[n.kind];
    const Icon = meta.icon;
    return (
      <div className="group flex items-start gap-3">
        <span className={cn("mt-0.5 flex h-7 w-7 flex-none items-center justify-center rounded-full", meta.chip)}>
          <Icon size={14} />
        </span>
        <div className="min-w-0 flex-1 rounded-xl border border-border bg-elevated/40 px-3 py-2.5">
          <p className="whitespace-pre-line text-sm text-ink">{n.body}</p>
          <p className="mt-1 text-[0.7rem] text-faint">
            {meta.label} · {formatDate(n.created_at)}
          </p>
        </div>
        <button
          type="button"
          aria-label="Eintrag löschen"
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

  const composer = KIND_META[logKind];
  const placeholder =
    logKind === "call"
      ? "Anruf protokollieren …"
      : logKind === "meeting"
        ? "Meeting protokollieren …"
        : "Notiz hinzufügen …";

  return (
    <Card>
      <CardBody className="space-y-4">
        {/* Tabs */}
        <div className="-mx-1 flex gap-1 overflow-x-auto border-b border-border px-1">
          {TABS.map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => setTab(t.key)}
              className={cn(
                "-mb-px flex-none border-b-2 px-3 py-2 text-sm font-medium transition-colors",
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
        {tab === "aufgaben" ? (
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
        ) : tab !== "emails" ? (
          <div className="space-y-2">
            <textarea
              ref={noteRef}
              rows={2}
              placeholder={placeholder}
              onKeyDown={(e) => {
                if ((e.metaKey || e.ctrlKey) && e.key === "Enter") saveNote();
              }}
              className="w-full rounded-xl border border-border bg-surface px-3 py-2 text-sm text-ink placeholder:text-faint focus-visible:ring-2 focus-visible:ring-brand"
            />
            <div className="flex justify-end">
              <Button onClick={saveNote} disabled={pending}>
                <composer.icon size={15} /> {composer.label} speichern
              </Button>
            </div>
          </div>
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
