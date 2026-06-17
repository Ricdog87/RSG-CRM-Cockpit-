import Link from "next/link";
import { EmptyState } from "@/components/ui/EmptyState";
import { IconMail } from "@/components/ui/icons";
import { formatDate } from "@/lib/format";
import { cn } from "@/components/ui/cn";
import type { EmailActivity } from "@/lib/email-data";

/** Korrespondenz-Timeline (Postfach + Account-Detail). */
export function EmailTimeline({
  activities,
  emptyText = "Noch keine getrackten E-Mails.",
  limit,
}: {
  activities: EmailActivity[];
  emptyText?: string;
  /** Nur die letzten N E-Mails zeigen (z.B. 5), Rest per Hinweis aufs Postfach. */
  limit?: number;
}) {
  if (activities.length === 0) {
    return <EmptyState title={emptyText} icon={<IconMail size={22} />} />;
  }
  // Neueste zuerst; bei gesetztem Limit nur die jüngsten N anzeigen.
  const sorted = [...activities].sort((a, b) =>
    (b.occurred_at || "").localeCompare(a.occurred_at || "")
  );
  const shown = limit ? sorted.slice(0, limit) : sorted;
  const hidden = activities.length - shown.length;

  return (
    <div className="space-y-2">
      <ul className="space-y-2">
        {shown.map((a) => {
          const out = a.direction === "outbound";
          return (
            <li
              key={a.id}
              className="flex gap-3 rounded-xl border border-border bg-surface px-3 py-2.5"
            >
              <span
                className={cn(
                  "mt-0.5 flex h-8 w-8 flex-none items-center justify-center rounded-lg text-xs font-bold",
                  out ? "bg-brand/10 text-brand-deep" : "bg-success/10 text-success"
                )}
                title={out ? "Gesendet" : "Empfangen"}
              >
                {out ? "↑" : "↓"}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <p className="truncate text-sm font-medium text-ink">{a.subject}</p>
                  <span className="flex-none text-xs text-faint">
                    {formatDate(a.occurred_at)}
                  </span>
                </div>
                <p className="truncate text-xs text-muted">
                  {out ? `an ${a.to_email}` : `von ${a.from_name || a.from_email}`}
                </p>
                {a.snippet ? (
                  <p className="mt-1 line-clamp-2 text-xs text-faint">{a.snippet}</p>
                ) : null}
              </div>
            </li>
          );
        })}
      </ul>
      {hidden > 0 ? (
        <Link
          href="/cockpit/postfach"
          className="flex items-center justify-center gap-1 rounded-xl border border-border bg-elevated/40 px-3 py-2 text-xs font-medium text-muted hover:text-ink"
        >
          + {hidden} weitere E-Mail{hidden === 1 ? "" : "s"} im Postfach
        </Link>
      ) : null}
    </div>
  );
}
