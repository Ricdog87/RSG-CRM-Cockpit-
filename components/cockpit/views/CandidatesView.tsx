"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "@/lib/toast";
import { KanbanBoard, type BoardColumn } from "@/components/cockpit/KanbanBoard";
import { MoveSelect } from "@/components/cockpit/MoveSelect";
import { EditDialog } from "@/components/cockpit/EditDialog";
import { RowActions } from "@/components/cockpit/RowActions";
import { FilterTabs } from "@/components/ui/FilterTabs";
import { ViewToggle } from "@/components/ui/ViewToggle";
import { Badge } from "@/components/ui/Badge";
import { IconMail, IconPhone, IconFolder, IconSearch, IconDashboard, IconLayers } from "@/components/ui/icons";
import { CANDIDATE_FIELDS, withDatalist, withSelectOptions, candidateInitial } from "@/lib/crm-forms";
import { updateCandidateStage, updateCandidate, deleteCandidate } from "@/lib/crm-actions";
import { cvSignedUrl } from "@/lib/cv-actions";
import { formatDate } from "@/lib/format";
import { downloadCsv } from "@/lib/csv-export";
import { cn } from "@/components/ui/cn";
import type { FormField } from "@/components/cockpit/EntityFormDialog";
import type { Candidate, CandidateStage } from "@/lib/crm-types";

const COLUMNS: BoardColumn<CandidateStage>[] = [
  { stage: "neu", label: "Neu", tone: "neutral" },
  { stage: "screening", label: "Screening", tone: "sky" },
  { stage: "interview", label: "Interview", tone: "brand" },
  { stage: "angebot", label: "Angebot", tone: "brand" },
  { stage: "platziert", label: "Platziert", tone: "success" },
];

const STAGE_OPTIONS = COLUMNS.map((c) => ({ value: c.stage, label: c.label }));

const STAGE_TONE: Record<CandidateStage, "neutral" | "sky" | "brand" | "success" | "danger"> = {
  neu: "neutral",
  screening: "sky",
  interview: "brand",
  angebot: "brand",
  platziert: "success",
  abgelehnt: "danger",
};
const STAGE_LABEL: Record<CandidateStage, string> = {
  neu: "Neu",
  screening: "Screening",
  interview: "Interview",
  angebot: "Angebot",
  platziert: "Platziert",
  abgelehnt: "Abgelehnt",
};

function initials(name: string): string {
  return name
    .split(" ")
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

function Avatar({ name, size = 40 }: { name: string; size?: number }) {
  return (
    <span
      className="flex flex-none items-center justify-center rounded-full bg-gradient-to-br from-brand to-sky font-bold text-white"
      style={{ height: size, width: size, fontSize: size * 0.36 }}
    >
      {initials(name) || "?"}
    </span>
  );
}

function Stars({ value }: { value: number }) {
  if (!value) return null;
  return (
    <span className="inline-flex items-center" aria-label={`${value} von 5 Sternen`}>
      {[1, 2, 3, 4, 5].map((v) => (
        <svg
          key={v}
          width="13"
          height="13"
          viewBox="0 0 24 24"
          fill={v <= value ? "#f59e0b" : "none"}
          stroke={v <= value ? "#f59e0b" : "#cbd5e1"}
          strokeWidth="1.5"
        >
          <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14l-5-4.87 6.91-1.01L12 2z" />
        </svg>
      ))}
    </span>
  );
}

function CvLink({ path }: { path: string }) {
  const [loading, setLoading] = useState(false);
  async function open() {
    setLoading(true);
    try {
      const res = await cvSignedUrl(path);
      if (res.ok && res.url) window.open(res.url, "_blank", "noopener,noreferrer");
    } finally {
      setLoading(false);
    }
  }
  return (
    <button
      type="button"
      onClick={open}
      disabled={loading}
      className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[0.7rem] font-medium text-brand transition-colors hover:bg-brand/10 disabled:opacity-60"
      title="CV öffnen"
    >
      <IconFolder size={12} /> {loading ? "öffne …" : "CV"}
    </button>
  );
}

function TagChips({ tags, max = 3 }: { tags: string[]; max?: number }) {
  if (!tags.length) return null;
  const shown = tags.slice(0, max);
  const rest = tags.length - shown.length;
  return (
    <span className="flex flex-wrap items-center gap-1">
      {shown.map((t) => (
        <span key={t} className="rounded-full border border-border bg-elevated px-1.5 py-0.5 text-[0.65rem] text-muted">
          {t}
        </span>
      ))}
      {rest > 0 ? <span className="text-[0.65rem] text-faint">+{rest}</span> : null}
    </span>
  );
}

function CandidateCard({
  c,
  onMove,
  onDelete,
  editFields,
}: {
  c: Candidate;
  onMove: (id: string, stage: CandidateStage) => void;
  onDelete: (id: string) => void;
  editFields: FormField[];
}) {
  return (
    <div className="rounded-2xl border border-border bg-surface p-4 shadow-sm transition-all hover:border-brand/40 hover:shadow">
      <div className="flex items-start gap-3">
        <Avatar name={c.name} />
        <Link href={`/cockpit/kandidaten/${c.id}`} className="group min-w-0 flex-1" title="Profil öffnen">
          <p className="truncate text-sm font-semibold text-ink group-hover:text-brand-deep group-hover:underline">
            {c.name}
          </p>
          <p className="truncate text-xs text-muted">{c.role || "Position offen"}</p>
        </Link>
        <RowActions
          confirmText={`„${c.name}" wirklich löschen?`}
          onDelete={() => onDelete(c.id)}
          editNode={
            <EditDialog
              id={c.id}
              title="Kandidat:in bearbeiten"
              fields={editFields}
              action={updateCandidate}
              initial={candidateInitial(c)}
            />
          }
        />
      </div>

      {(c.rating ?? 0) > 0 || (c.tags?.length ?? 0) > 0 ? (
        <div className="mt-2.5 flex flex-wrap items-center gap-2">
          <Stars value={c.rating ?? 0} />
          <TagChips tags={c.tags ?? []} />
        </div>
      ) : null}

      {c.email || c.phone ? (
        <div className="mt-3 space-y-1">
          {c.email ? (
            <a href={`mailto:${c.email}`} className="flex items-center gap-1.5 truncate text-xs text-muted hover:text-brand">
              <IconMail size={12} /> <span className="truncate">{c.email}</span>
            </a>
          ) : null}
          {c.phone ? (
            <a href={`tel:${c.phone.replace(/\s+/g, "")}`} className="flex items-center gap-1.5 truncate text-xs text-muted hover:text-brand">
              <IconPhone size={12} /> <span className="truncate">{c.phone}</span>
            </a>
          ) : null}
        </div>
      ) : null}

      {c.mandate_account ? (
        <p className="mt-2.5 truncate text-xs font-medium text-faint">{c.mandate_account}</p>
      ) : null}
      <div className="mt-3 flex items-center justify-between text-[0.7rem] text-faint">
        <span className="flex items-center gap-1.5">
          <span className="truncate">{c.source}</span>
          {c.cv_path ? <CvLink path={c.cv_path} /> : null}
        </span>
        <span>{formatDate(c.updated_at)}</span>
      </div>
      <MoveSelect<CandidateStage>
        value={c.stage}
        options={STAGE_OPTIONS}
        onMove={(stage) => onMove(c.id, stage)}
      />
    </div>
  );
}

function CandidateRow({ c }: { c: Candidate }) {
  return (
    <Link
      href={`/cockpit/kandidaten/${c.id}`}
      className="group flex items-center gap-3 px-3 py-2.5 transition-colors hover:bg-elevated/50"
    >
      <Avatar name={c.name} size={36} />
      <div className="min-w-0 flex-[2]">
        <p className="truncate text-sm font-semibold text-ink group-hover:text-brand-deep">{c.name}</p>
        <p className="truncate text-xs text-muted">{c.role || "Position offen"}</p>
      </div>
      <div className="hidden min-w-0 flex-[2] md:block">
        <p className="truncate text-xs text-muted">{c.email || "—"}</p>
        <p className="truncate text-[0.7rem] text-faint">{c.mandate_account || ""}</p>
      </div>
      <div className="hidden flex-1 lg:flex">
        <Stars value={c.rating ?? 0} />
      </div>
      <div className="hidden min-w-0 flex-[1.5] xl:block">
        <TagChips tags={c.tags ?? []} max={2} />
      </div>
      <div className="flex flex-none items-center gap-2">
        {c.cv_path ? <IconFolder size={13} className="text-faint" /> : null}
        <Badge tone={STAGE_TONE[c.stage]}>{STAGE_LABEL[c.stage]}</Badge>
      </div>
    </Link>
  );
}

/** Kandidaten-Ansicht: Board (Kanban) oder Liste, mit Suche & Mandats-Filter. */
export function CandidatesView({
  candidates,
  accountNames = [],
  mandateOptions = [],
}: {
  candidates: Candidate[];
  accountNames?: string[];
  mandateOptions?: { value: string; label: string }[];
}) {
  const router = useRouter();
  const [items, setItems] = useState(candidates);
  useEffect(() => setItems(candidates), [candidates]);
  const [filter, setFilter] = useState<string>("all");
  const [view, setView] = useState<"board" | "liste">("liste");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<"updated" | "rating" | "name">("updated");
  const [activeTags, setActiveTags] = useState<string[]>([]);
  const editFields = withSelectOptions(
    withDatalist(CANDIDATE_FIELDS, "mandate_account", accountNames),
    "mandate_id",
    [{ value: "", label: "— kein Mandat —" }, ...mandateOptions]
  );

  async function move(id: string, stage: CandidateStage) {
    const prevItems = items;
    setItems((prev) => prev.map((c) => (c.id === id ? { ...c, stage } : c)));
    const res = await updateCandidateStage(id, stage);
    if (res.ok && !res.demo) router.refresh();
    else if (!res.ok) {
      setItems(prevItems); // fehlgeschlagen → Phase zurücksetzen
      if (res.error) toast.error(res.error);
    }
  }

  async function onDelete(id: string) {
    const prevItems = items;
    setItems((p) => p.filter((c) => c.id !== id));
    const res = await deleteCandidate(id);
    if (res.ok && !res.demo) {
      router.refresh();
    } else if (!res.ok) {
      setItems(prevItems);
      if (res.error) toast.error(res.error);
    }
  }

  const mandates = useMemo(
    () => Array.from(new Set(items.map((c) => c.mandate_account).filter(Boolean))),
    [items]
  );
  const rejected = items.filter((c) => c.stage === "abgelehnt");
  const base = items.filter((c) => c.stage !== "abgelehnt");

  const allTags = useMemo(
    () => Array.from(new Set(items.flatMap((c) => c.tags ?? []))).sort((a, b) => a.localeCompare(b)),
    [items]
  );

  function toggleTag(t: string) {
    setActiveTags((prev) => (prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]));
  }

  // Talent-Pool: verfügbare Kandidat:innen ohne aktuelles Mandat (Bench).
  const talentPool = base.filter((c) => !c.mandate_id && !c.mandate_account);

  const q = query.trim().toLowerCase();
  const filtered = useMemo(() => {
    let pool =
      filter === "abgelehnt"
        ? rejected
        : filter === "pool"
          ? talentPool
          : filter === "all"
            ? base
            : base.filter((c) => c.mandate_account === filter);
    if (activeTags.length) {
      pool = pool.filter((c) => (c.tags ?? []).some((t) => activeTags.includes(t)));
    }
    if (q) {
      pool = pool.filter((c) =>
        [c.name, c.role, c.email, c.mandate_account, ...(c.tags ?? [])]
          .filter(Boolean)
          .some((v) => String(v).toLowerCase().includes(q))
      );
    }
    return pool;
  }, [filter, q, base, rejected, talentPool, activeTags]);

  const displayed = useMemo(() => {
    const arr = [...filtered];
    if (sort === "name") arr.sort((a, b) => a.name.localeCompare(b.name));
    else if (sort === "rating")
      arr.sort(
        (a, b) => (b.rating ?? 0) - (a.rating ?? 0) || (b.updated_at ?? "").localeCompare(a.updated_at ?? "")
      );
    else arr.sort((a, b) => (b.updated_at ?? "").localeCompare(a.updated_at ?? ""));
    return arr;
  }, [filtered, sort]);

  // Paginierung der Listenansicht (Performance bei vielen Kandidat:innen).
  const PAGE = 50;
  const [visible, setVisible] = useState(PAGE);
  useEffect(() => setVisible(PAGE), [filter, query, sort, activeTags, view]);
  const pageList = displayed.slice(0, visible);

  return (
    <div className="space-y-4">
      {/* Toolbar: Suche + Ansicht-Umschalter */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-0 flex-1">
          <IconSearch size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-faint" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Kandidat:in suchen (Name, Rolle, E-Mail, Tag) …"
            className="w-full rounded-xl border border-border bg-surface py-2 pl-9 pr-3 text-sm text-ink placeholder:text-faint focus-visible:ring-2 focus-visible:ring-brand"
          />
        </div>
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value as typeof sort)}
          aria-label="Sortieren"
          className="rounded-xl border border-border bg-surface px-3 py-2 text-sm text-ink focus-visible:ring-2 focus-visible:ring-brand"
        >
          <option value="updated">Zuletzt aktualisiert</option>
          <option value="rating">Bewertung ↓</option>
          <option value="name">Name A–Z</option>
        </select>
        <button
          type="button"
          onClick={() =>
            downloadCsv(`kandidaten-${new Date().toISOString().slice(0, 10)}`, displayed, [
              { key: "name", label: "Name" },
              { key: "role", label: "Rolle" },
              { key: "email", label: "E-Mail" },
              { key: "phone", label: "Telefon" },
              { key: "stage", label: "Phase" },
              { key: "source", label: "Quelle" },
              { key: "mandate_account", label: "Mandat/Account" },
              { key: "location", label: "Ort" },
              { key: "current_employer", label: "Arbeitgeber" },
              { key: "experience_years", label: "Erfahrung (J.)" },
              { key: "salary_expectation", label: "Gehaltswunsch" },
              { key: "availability", label: "Verfügbarkeit" },
              { key: "rating", label: "Bewertung" },
            ])
          }
          className="rounded-xl border border-border bg-surface px-3 py-2 text-sm font-medium text-ink hover:bg-elevated"
          title="Gefilterte Liste als CSV exportieren"
        >
          Export
        </button>
        <ViewToggle<"liste" | "board">
          value={view}
          onChange={setView}
          options={[
            { value: "liste", label: "Liste", icon: <IconLayers size={14} /> },
            { value: "board", label: "Board", icon: <IconDashboard size={14} /> },
          ]}
        />
      </div>

      {/* Tag-Schnellfilter */}
      {allTags.length > 0 ? (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-xs text-faint">Tags:</span>
          {allTags.map((t) => {
            const on = activeTags.includes(t);
            return (
              <button
                key={t}
                type="button"
                onClick={() => toggleTag(t)}
                className={cn(
                  "rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors",
                  on
                    ? "border-brand bg-brand/10 text-brand-deep"
                    : "border-border bg-elevated/50 text-muted hover:border-brand/40"
                )}
              >
                {t}
              </button>
            );
          })}
          {activeTags.length > 0 ? (
            <button
              type="button"
              onClick={() => setActiveTags([])}
              className="text-xs text-faint underline hover:text-ink"
            >
              zurücksetzen
            </button>
          ) : null}
        </div>
      ) : null}

      <FilterTabs<string>
        value={filter}
        onChange={setFilter}
        options={[
          { value: "all", label: "Alle Mandate", count: base.length },
          ...(talentPool.length > 0
            ? [{ value: "pool", label: "Talent-Pool", count: talentPool.length }]
            : []),
          ...mandates.map((m) => ({
            value: m,
            label: m,
            count: base.filter((c) => c.mandate_account === m).length,
          })),
          ...(rejected.length > 0
            ? [{ value: "abgelehnt", label: "Abgelehnte", count: rejected.length }]
            : []),
        ]}
      />

      {view === "board" ? (
        <KanbanBoard
          columns={COLUMNS}
          items={displayed}
          getStage={(c) => c.stage}
          renderCard={(c) => (
            <CandidateCard c={c} onMove={move} onDelete={onDelete} editFields={editFields} />
          )}
          emptyText="Keine Kandidat:innen in diesem Filter."
        />
      ) : (
        <div className="overflow-hidden rounded-2xl border border-border bg-surface shadow-card">
          <div className="flex items-center justify-between border-b border-border px-3 py-2 text-[0.7rem] font-medium uppercase tracking-wider text-faint">
            <span>{displayed.length} Kandidat:innen</span>
            <span className="hidden lg:inline">Bewertung · Phase</span>
          </div>
          {displayed.length === 0 ? (
            <p className="px-3 py-10 text-center text-sm text-muted">
              Keine Kandidat:innen in dieser Auswahl.
            </p>
          ) : (
            <ul className="divide-y divide-border/70">
              {pageList.map((c) => (
                <li key={c.id}>
                  <CandidateRow c={c} />
                </li>
              ))}
            </ul>
          )}
          {displayed.length > visible ? (
            <div className="flex items-center justify-center gap-3 border-t border-border px-3 py-3">
              <span className="text-xs text-faint">{visible} von {displayed.length} angezeigt</span>
              <button
                type="button"
                onClick={() => setVisible((v) => v + PAGE)}
                className="rounded-lg border border-border bg-elevated px-3 py-1.5 text-xs font-semibold text-ink hover:bg-elevated/70"
              >
                Mehr anzeigen
              </button>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
