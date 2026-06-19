"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Card, CardBody, SectionHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { IconTrash } from "@/components/ui/icons";
import { formatDate } from "@/lib/format";
import { addNote, deleteNote } from "@/lib/crm-actions";
import { toast } from "@/lib/toast";
import type { Note } from "@/lib/notes-data";

export function AccountNotes({
  accountId,
  notes,
}: {
  accountId: string;
  notes: Note[];
}) {
  const router = useRouter();
  const [items, setItems] = useState<Note[]>(notes);
  useEffect(() => setItems(notes), [notes]);
  const [pending, start] = useTransition();
  const ref = useRef<HTMLTextAreaElement>(null);

  function save() {
    const body = ref.current?.value.trim();
    if (!body) return;
    const optimistic: Note = {
      id: `tmp-${Date.now()}`,
      body,
      created_at: new Date().toISOString(),
    };
    setItems((prev) => [optimistic, ...prev]);
    const savedBody = body;
    if (ref.current) ref.current.value = "";
    start(async () => {
      const res = await addNote(accountId, body);
      if (res.ok && !res.demo) {
        if (res.redirect) router.replace(res.redirect);
        else router.refresh();
      } else if (!res.ok) {
        setItems((prev) => prev.filter((n) => n.id !== optimistic.id));
        if (ref.current && !ref.current.value) ref.current.value = savedBody; // Text nicht verlieren
        toast.error(res.error ?? "Notiz konnte nicht gespeichert werden.");
      }
    });
  }

  function remove(id: string) {
    const prev = items;
    setItems((p) => p.filter((n) => n.id !== id));
    start(async () => {
      const res = await deleteNote(id, accountId);
      if (res.ok && !res.demo) router.refresh();
      else if (!res.ok) {
        setItems(prev); // fehlgeschlagen → Notiz wiederherstellen
        toast.error(res.error ?? "Löschen fehlgeschlagen.");
      }
    });
  }

  return (
    <Card>
      <CardBody>
        <SectionHeader title="Notizen" hint="Gespräche, Kontext, nächste Schritte" />

        <div className="mb-4 space-y-2">
          <textarea
            ref={ref}
            rows={2}
            placeholder="Notiz hinzufügen …"
            onKeyDown={(e) => {
              if ((e.metaKey || e.ctrlKey) && e.key === "Enter") save();
            }}
            className="w-full rounded-xl border border-border bg-surface px-3 py-2 text-sm text-ink placeholder:text-faint focus-visible:ring-2 focus-visible:ring-brand"
          />
          <div className="flex justify-end">
            <Button onClick={save} disabled={pending}>
              {pending ? "Speichert …" : "Notiz speichern"}
            </Button>
          </div>
        </div>

        {items.length === 0 ? (
          <EmptyState title="Noch keine Notizen. Halte fest, was du über diesen Kunden weißt." />
        ) : (
          <ul className="space-y-2">
            {items.map((n) => (
              <li
                key={n.id}
                className="group flex items-start justify-between gap-3 rounded-xl border border-border bg-elevated/40 px-3 py-2.5"
              >
                <div className="min-w-0">
                  <p className="whitespace-pre-line text-sm text-ink">{n.body}</p>
                  <p className="mt-1 text-[0.7rem] text-faint">{formatDate(n.created_at)}</p>
                </div>
                <button
                  type="button"
                  aria-label="Notiz löschen"
                  onClick={() => remove(n.id)}
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
