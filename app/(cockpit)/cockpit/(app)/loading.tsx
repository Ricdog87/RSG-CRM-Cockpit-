import { Skeleton, TableSkeleton } from "@/components/ui/Skeleton";

/** Ladezustand des Inhaltsbereichs – Shell (Sidebar/Topbar) bleibt bestehen. */
export default function CockpitLoading() {
  return (
    <div className="space-y-6">
      {/* Kopfzeile */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="space-y-2">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-7 w-56" />
        </div>
        <Skeleton className="h-9 w-32 rounded-xl" />
      </div>

      {/* KPI-Karten */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-28 rounded-2xl" />
        ))}
      </div>

      {/* Liste */}
      <TableSkeleton rows={8} />
    </div>
  );
}
