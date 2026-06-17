"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { EmptyState } from "@/components/ui/EmptyState";
import { IconCheck, IconTrash } from "@/components/ui/icons";
import { formatDate } from "@/lib/format";
import { anonymizeCandidate, deleteCandidate } from "@/lib/crm-actions";
import type { RetentionItem } from "@/lib/retention-data";

export function RetentionList({ items }: { items: RetentionItem[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [list, setList] = useState(items);
  const [busy, setBusy] = useState<string | null>(null);

  function anonymize(id: string) {
    setBusy(id);
    start(async () => {
      const res = await anonymizeCandidate(id);
      setBusy(null);
      if (res.ok) {
        setList((p) => p.filter((x) => x.candidate_id !== id));
        if (!res.demo) router.refresh();
      }
    });
  }
  function remove(id: string) {
    if (!confirm("Kandidat:in endgültig löschen? Das kann nicht rückgängig gemacht werden.")) return;
    setBusy(id);
    start(async () => {
      const res = await deleteCandidate(id);
      setBusy(null);
      if (res.ok) {
        setList((p) => p.filter((x) => x.candidate_id !== id));
        if (!res.demo) router.refresh();
      }
    });
  }

  if (list.length === 0) {
    return <EmptyState icon={<IconCheck size={20} />} title="Keine fälligen Löschungen – alle Daten DSGVO-konform." />;
  }

  return (
    <ul className="space-y-2">
      {list.map((it) => (
        <li key={it.candidate_id} className="flex items-center justify-between gap-3 rounded-xl border border-border bg-elevated/40 px-3 py-2.5">
          <div className="min-w-0">
            <Link href={`/cockpit/kandidaten/${it.candidate_id}`} className="truncate text-sm font-medium text-ink hover:text-brand-deep">
              {it.name}
            </Link>
            <p className="truncate text-xs text-faint">
              {it.reason}{it.since ? ` · ${formatDate(it.since)}` : ""}
            </p>
          </div>
          <div className="flex flex-none items-center gap-1.5">
            <button
              type="button"
              onClick={() => anonymize(it.candidate_id)}
              disabled={pending && busy === it.candidate_id}
              className="rounded-lg border border-brand/30 bg-brand/10 px-2.5 py-1.5 text-xs font-semibold text-brand-deep hover:bg-brand/15 disabled:opacity-60"
            >
              Anonymisieren
            </button>
            <button
              type="button"
              aria-label="Löschen"
              onClick={() => remove(it.candidate_id)}
              disabled={pending && busy === it.candidate_id}
              className="rounded-lg p-1.5 text-faint hover:bg-danger/10 hover:text-danger"
            >
              <IconTrash size={14} />
            </button>
          </div>
        </li>
      ))}
    </ul>
  );
}
