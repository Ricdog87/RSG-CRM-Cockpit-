"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "@/lib/toast";
import { Card, CardBody } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { EditDialog } from "@/components/cockpit/EditDialog";
import { RowActions } from "@/components/cockpit/RowActions";
import { SEGMENT_FIELDS } from "@/lib/crm-forms";
import { updateSegment, deleteSegment } from "@/lib/crm-actions";
import { formatEur, formatNumber } from "@/lib/format";
import type { Segment } from "@/lib/crm-types";

/** Segment-Karten mit Bearbeiten und Löschen. */
export function SegmentsView({ segments }: { segments: Segment[] }) {
  const router = useRouter();
  const [items, setItems] = useState(segments);
  useEffect(() => setItems(segments), [segments]);

  async function onDelete(id: string) {
    const prevItems = items;
    setItems((p) => p.filter((s) => s.id !== id));
    const res = await deleteSegment(id);
    if (res.ok && !res.demo) {
      router.refresh();
    } else if (!res.ok) {
      setItems(prevItems);
      if (res.error) toast.error(res.error);
    }
  }

  if (items.length === 0) {
    return (
      <EmptyState title="Noch keine Segmente. Lege deine erste KI-Zielgruppe an, um gezielt zu akquirieren." />
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {items.map((s) => (
        <Card key={s.id} className="card-hover">
          <CardBody className="space-y-3">
            <div className="flex items-start justify-between gap-2">
              <h3 className="min-w-0 truncate text-base font-semibold text-ink">{s.name}</h3>
              <div className="flex flex-none items-center gap-1">
                <Badge tone="sky">{formatNumber(s.accounts)} Accounts</Badge>
                <RowActions
                  confirmText={`Segment „${s.name}" wirklich löschen?`}
                  onDelete={() => onDelete(s.id)}
                  editNode={
                    <EditDialog
                      id={s.id}
                      title="Segment bearbeiten"
                      fields={SEGMENT_FIELDS}
                      action={updateSegment}
                      initial={{
                        name: s.name,
                        description: s.description,
                        top_product: s.top_product,
                      }}
                    />
                  }
                />
              </div>
            </div>
            <p className="text-sm text-muted">{s.description}</p>
            <div className="flex items-center justify-between border-t border-border/60 pt-3 text-sm">
              <span className="text-faint">
                Top: <span className="text-muted">{s.top_product}</span>
              </span>
              <span className="font-semibold text-ink">{formatEur(s.mrr)}/M</span>
            </div>
          </CardBody>
        </Card>
      ))}
    </div>
  );
}
