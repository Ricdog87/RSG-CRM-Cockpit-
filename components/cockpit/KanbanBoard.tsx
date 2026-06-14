import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { Card, CardBody } from "@/components/ui/Card";

type Tone = "neutral" | "sky" | "brand" | "success" | "warning" | "danger";

export interface BoardColumn<S extends string> {
  stage: S;
  label: string;
  tone: Tone;
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
    <div className="-mx-1 flex gap-3 overflow-x-auto px-1 pb-2 xl:overflow-visible">
      {columns.map((col) => {
        const colItems = items.filter((i) => getStage(i) === col.stage);
        return (
          <div
            key={col.stage}
            className="flex w-60 flex-none flex-col gap-3 rounded-2xl border border-border/60 bg-surface/40 p-3 xl:w-auto xl:flex-1"
          >
            <div className="flex items-center justify-between">
              <Badge tone={col.tone}>{col.label}</Badge>
              <span className="text-xs text-faint">{colItems.length}</span>
            </div>
            <div className="space-y-2">
              {colItems.length === 0 ? (
                <p className="px-1 py-4 text-center text-xs text-faint">—</p>
              ) : (
                colItems.map((item) => (
                  <div key={(item as { id: string }).id}>{renderCard(item)}</div>
                ))
              )}
            </div>
            {columnFooter && colItems.length > 0 ? (
              <div className="mt-auto border-t border-border/60 pt-2 text-xs text-muted">
                {columnFooter(colItems)}
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
