"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { Card, CardBody } from "@/components/ui/Card";

type Tone = "neutral" | "sky" | "brand" | "success" | "warning" | "danger";

/** Maximale Karten pro Spalte, bevor „+ N weitere" eingeblendet wird. */
const COLUMN_CAP = 25;

export interface BoardColumn<S extends string> {
  stage: S;
  label: string;
  tone: Tone;
}

function KanbanColumn<S extends string, T>({
  col,
  colItems,
  renderCard,
  columnFooter,
}: {
  col: BoardColumn<S>;
  colItems: T[];
  renderCard: (item: T) => React.ReactNode;
  columnFooter?: (items: T[]) => React.ReactNode;
}) {
  const [expanded, setExpanded] = useState(false);
  const visible = expanded ? colItems : colItems.slice(0, COLUMN_CAP);
  const hidden = colItems.length - visible.length;

  return (
    <div className="flex w-72 flex-none flex-col gap-3 rounded-2xl border border-border/60 bg-surface/40 p-4 xl:w-auto xl:flex-1">
      <div className="flex items-center justify-between">
        <Badge tone={col.tone}>{col.label}</Badge>
        <span className="text-xs font-medium text-faint">{colItems.length}</span>
      </div>
      <div className="space-y-2.5">
        {colItems.length === 0 ? (
          <p className="px-1 py-4 text-center text-xs text-faint">—</p>
        ) : (
          visible.map((item) => <div key={(item as { id: string }).id}>{renderCard(item)}</div>)
        )}
        {hidden > 0 ? (
          <button
            type="button"
            onClick={() => setExpanded(true)}
            className="w-full rounded-lg border border-border bg-elevated/60 px-3 py-1.5 text-xs font-semibold text-muted transition-colors hover:bg-elevated hover:text-ink"
          >
            + {hidden} weitere anzeigen
          </button>
        ) : null}
      </div>
      {columnFooter && colItems.length > 0 ? (
        <div className="mt-auto border-t border-border/60 pt-2 text-xs text-muted">
          {columnFooter(colItems)}
        </div>
      ) : null}
    </div>
  );
}

/** Generisches Kanban-Board: gruppiert Items nach Phase in Spalten. */
export function KanbanBoard<S extends string, T>({
  columns,
  items,
  getStage,
  renderCard,
  columnFooter,
  emptyText,
}: {
  columns: BoardColumn<S>[];
  items: T[];
  getStage: (item: T) => S;
  renderCard: (item: T) => React.ReactNode;
  columnFooter?: (items: T[]) => React.ReactNode;
  emptyText: string;
}) {
  if (items.length === 0) {
    return (
      <Card>
        <CardBody>
          <EmptyState title={emptyText} />
        </CardBody>
      </Card>
    );
  }

  return (
    <div className="-mx-1 flex gap-4 overflow-x-auto px-1 pb-2 xl:overflow-visible">
      {columns.map((col) => (
        <KanbanColumn
          key={col.stage}
          col={col}
          colItems={items.filter((i) => getStage(i) === col.stage)}
          renderCard={renderCard}
          columnFooter={columnFooter}
        />
      ))}
    </div>
  );
}
