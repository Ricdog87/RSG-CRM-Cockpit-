import Link from "next/link";
import { IconAlertTriangle, IconChevronRight } from "@/components/ui/icons";

/**
 * Freundlicher Ersatz für ein hartes 404, wenn ein verknüpfter Datensatz
 * (Deep-Link aus Aufgaben/Suche) gelöscht wurde oder nicht mehr existiert.
 */
export function RecordUnavailable({
  backHref,
  backLabel,
}: {
  backHref: string;
  backLabel: string;
}) {
  return (
    <div className="mx-auto max-w-md space-y-5 py-16 text-center">
      <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-warning/10 text-warning">
        <IconAlertTriangle size={26} />
      </span>
      <div className="space-y-1">
        <h1 className="text-lg font-bold text-ink">Datensatz nicht verfügbar</h1>
        <p className="text-sm text-muted">
          Dieser Datensatz wurde gelöscht oder ist nicht mehr verfügbar.
        </p>
      </div>
      <div className="flex flex-wrap items-center justify-center gap-2">
        <Link
          href={backHref}
          className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-brand to-sky px-4 py-2 text-sm font-semibold text-white shadow-glow"
        >
          {backLabel} <IconChevronRight size={15} />
        </Link>
        <Link
          href="/cockpit/aufgaben"
          className="inline-flex items-center rounded-xl border border-border bg-surface px-4 py-2 text-sm font-medium text-ink hover:bg-elevated"
        >
          Zu den Aufgaben
        </Link>
      </div>
    </div>
  );
}
