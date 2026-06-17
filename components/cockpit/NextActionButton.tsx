"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { IconPlus, IconCheck } from "@/components/ui/icons";
import { addTask } from "@/lib/crm-actions";

/** Erstellt aus der nächsten besten Aktion eine terminierte Aufgabe (morgen). */
export function NextActionButton({
  accountId,
  accountName,
  action,
}: {
  accountId: string;
  accountName: string;
  action: string;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function create() {
    setError(null);
    start(async () => {
      const due = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
      const res = await addTask({
        related_type: "customer",
        related_id: accountId,
        related_label: accountName,
        title: action,
        due_date: due,
      });
      if (!res.ok) {
        setError(res.error ?? "Fehlgeschlagen.");
        return;
      }
      setDone(true);
      if (!res.demo) router.refresh();
    });
  }

  if (done)
    return (
      <span className="inline-flex items-center gap-1 text-xs font-semibold text-success">
        <IconCheck size={13} /> Aufgabe erstellt
      </span>
    );

  return (
    <span className="inline-flex flex-col items-start gap-1">
      <button
        type="button"
        onClick={create}
        disabled={pending}
        className="inline-flex items-center gap-1.5 rounded-lg border border-brand/40 bg-brand/10 px-2.5 py-1 text-xs font-semibold text-brand-deep transition-colors hover:bg-brand/15 disabled:opacity-60"
      >
        <IconPlus size={12} /> {pending ? "…" : "Als Aufgabe"}
      </button>
      {error ? <span className="text-[0.7rem] text-danger">{error}</span> : null}
    </span>
  );
}
