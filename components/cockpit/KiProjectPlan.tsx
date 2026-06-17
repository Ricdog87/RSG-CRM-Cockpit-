"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/Badge";
import { IconPlus, IconTrash, IconCheck, IconBolt } from "@/components/ui/icons";
import { formatDate } from "@/lib/format";
import {
  seedDefaultMilestones,
  addMilestone,
  updateMilestone,
  deleteMilestone,
  toggleReadiness,
} from "@/lib/ki-plan-actions";
import {
  milestoneStatusMeta,
  READINESS_ITEMS,
  type KiMilestone,
  type MilestoneStatus,
} from "@/lib/ki-plan";

const inp = "rounded-lg border border-border bg-surface px-2 py-1 text-xs text-ink";

// ---------- Meilensteine --------------------------------------------

export function MilestonesCard({
  projectId,
  milestones,
}: {
  projectId: string;
  milestones: KiMilestone[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [adding, setAdding] = useState(false);

  const done = milestones.filter((m) => m.status === "erledigt").length;
  const pct = milestones.length ? Math.round((done / milestones.length) * 100) : 0;

  function run(fn: () => Promise<{ ok: boolean; error?: string; demo?: boolean }>) {
    setError(null);
    start(async () => {
      const res = await fn();
      if (!res.ok) return setError(res.error ?? "Fehlgeschlagen.");
      if (!res.demo) router.refresh();
    });
  }

  if (milestones.length === 0) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-muted">
          Noch kein Projektplan. Lege den Standard-Plan an (Kickoff → … → Optimierung) oder einzelne Meilensteine.
        </p>
        {error ? <p className="text-xs text-danger">{error}</p> : null}
        <button
          type="button"
          onClick={() => run(() => seedDefaultMilestones(projectId))}
          disabled={pending}
          className="inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-brand to-sky px-3 py-2 text-xs font-semibold text-white shadow-glow disabled:opacity-60"
        >
          <IconBolt size={13} /> Standard-Projektplan anlegen
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-xs">
          <span className="text-faint">Fortschritt</span>
          <span className="font-semibold text-ink">{done}/{milestones.length} · {pct}%</span>
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-elevated">
          <div className="h-full rounded-full bg-gradient-to-r from-brand to-sky" style={{ width: `${pct}%` }} />
        </div>
      </div>

      <ol className="space-y-2">
        {milestones.map((m) => {
          const sm = milestoneStatusMeta[m.status];
          return (
            <li key={m.id} className="rounded-xl border border-border bg-elevated/40 p-2.5">
              <div className="flex items-start justify-between gap-2">
                <p className="min-w-0 truncate text-sm font-medium text-ink">{m.title}</p>
                <Badge tone={sm.tone}>{sm.label}</Badge>
              </div>
              <div className="mt-1.5 flex flex-wrap items-center gap-2">
                <select
                  value={m.status}
                  disabled={pending}
                  onChange={(e) => run(() => updateMilestone(m.id, projectId, { status: e.target.value as MilestoneStatus }))}
                  className={inp}
                >
                  {(Object.keys(milestoneStatusMeta) as MilestoneStatus[]).map((s) => (
                    <option key={s} value={s}>{milestoneStatusMeta[s].label}</option>
                  ))}
                </select>
                <input
                  type="date"
                  value={m.target_date ?? ""}
                  disabled={pending}
                  onChange={(e) => run(() => updateMilestone(m.id, projectId, { target_date: e.target.value || null }))}
                  className={inp}
                />
                {m.done_date ? <span className="text-[0.7rem] text-success">erledigt {formatDate(m.done_date)}</span> : null}
                <button
                  type="button"
                  aria-label="löschen"
                  onClick={() => run(() => deleteMilestone(m.id, projectId))}
                  disabled={pending}
                  className="ml-auto rounded-lg p-1 text-faint hover:bg-danger/10 hover:text-danger"
                >
                  <IconTrash size={13} />
                </button>
              </div>
            </li>
          );
        })}
      </ol>

      {error ? <p className="text-xs text-danger">{error}</p> : null}

      {adding ? (
        <div className="flex items-center gap-2">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Meilenstein-Titel"
            className="flex-1 rounded-lg border border-border bg-surface px-2.5 py-1.5 text-sm text-ink"
          />
          <button
            type="button"
            onClick={() => {
              run(() => addMilestone(projectId, title));
              setTitle("");
              setAdding(false);
            }}
            disabled={pending || !title.trim()}
            className="rounded-lg bg-brand/10 px-2.5 py-1.5 text-xs font-semibold text-brand-deep disabled:opacity-60"
          >
            <IconCheck size={12} />
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-elevated px-2.5 py-1.5 text-xs font-medium text-ink hover:border-brand/40"
        >
          <IconPlus size={13} /> Meilenstein
        </button>
      )}
    </div>
  );
}

// ---------- Go-Live-Readiness ---------------------------------------

export function ReadinessChecklist({
  projectId,
  state,
}: {
  projectId: string;
  state: Record<string, boolean>;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [local, setLocal] = useState(state);

  const done = READINESS_ITEMS.filter((it) => local[it.key]).length;
  const pct = Math.round((done / READINESS_ITEMS.length) * 100);

  function toggle(key: string, checked: boolean) {
    setLocal((p) => ({ ...p, [key]: checked }));
    start(async () => {
      const res = await toggleReadiness(projectId, key, checked);
      if (res.ok && !res.demo) router.refresh();
    });
  }

  return (
    <div className="space-y-3">
      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-xs">
          <span className="text-faint">Go-Live-Reife</span>
          <span className={`font-semibold ${pct === 100 ? "text-success" : "text-ink"}`}>{pct}%</span>
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-elevated">
          <div className={`h-full rounded-full ${pct === 100 ? "bg-success" : "bg-gradient-to-r from-brand to-sky"}`} style={{ width: `${pct}%` }} />
        </div>
      </div>
      <ul className="space-y-1">
        {READINESS_ITEMS.map((it) => (
          <li key={it.key}>
            <label className="flex cursor-pointer items-center gap-2.5 rounded-lg px-2 py-1.5 hover:bg-elevated">
              <input
                type="checkbox"
                checked={Boolean(local[it.key])}
                disabled={pending}
                onChange={(e) => toggle(it.key, e.target.checked)}
                className="h-4 w-4 flex-none accent-brand"
              />
              <span className={`text-sm ${local[it.key] ? "text-faint line-through" : "text-ink"}`}>{it.label}</span>
            </label>
          </li>
        ))}
      </ul>
    </div>
  );
}
