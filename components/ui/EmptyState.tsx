import { cn } from "@/components/ui/cn";

/**
 * Leerer Zustand als Handlungsaufforderung (Interface-Stimme).
 * Kein "Noch nichts da" — sondern der nächste konkrete Schritt.
 */
export function EmptyState({
  title,
  action,
  icon,
  className,
}: {
  title: string;
  action?: React.ReactNode;
  icon?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border bg-elevated/40 px-6 py-10 text-center",
        className
      )}
    >
      {icon ? <div className="text-faint">{icon}</div> : null}
      <p className="max-w-xs text-sm text-muted">{title}</p>
      {action}
    </div>
  );
}
