"use client";

import { useState } from "react";
import Link from "next/link";
import { Card, CardBody } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { IconAlertTriangle, IconChevronRight } from "@/components/ui/icons";
import type { DuplicateGroup } from "@/lib/account-dedupe";

/** Read-only Dubletten-Hinweis für die Kundenliste (Datenhygiene nach Import). */
export function AccountDuplicates({ groups }: { groups: DuplicateGroup[] }) {
  const [open, setOpen] = useState(false);
  if (groups.length === 0) return null;
  const totalDupes = groups.reduce((s, g) => s + g.accounts.length, 0);

  return (
    <Card className="border-warning/30 bg-warning/[0.04]">
      <CardBody className="space-y-3">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="flex w-full items-center justify-between gap-3"
        >
          <span className="flex items-center gap-2">
            <IconAlertTriangle size={16} className="text-warning" />
            <span className="text-sm font-semibold text-ink">
              {groups.length} mögliche Dubletten-Gruppe(n) · {totalDupes} Accounts
            </span>
          </span>
          <IconChevronRight size={16} className={`flex-none text-faint transition-transform ${open ? "rotate-90" : ""}`} />
        </button>

        {open ? (
          <div className="space-y-3">
            <p className="text-xs text-muted">
              Wahrscheinlich dieselbe Firma (gleicher Name bzw. gleiche E-Mail-Domain). Prüfe und
              pflege die Datensätze zusammen – Mandate/Projekte bleiben über den Namen verknüpft.
            </p>
            {groups.slice(0, 30).map((g, i) => (
              <div key={i} className="rounded-xl border border-border bg-surface p-3">
                <div className="mb-2 flex items-center gap-2">
                  <Badge tone={g.reason === "name" ? "warning" : "sky"}>
                    {g.reason === "name" ? "gleicher Name" : `Domain: ${g.key}`}
                  </Badge>
                  <span className="text-xs text-faint">{g.accounts.length} Einträge</span>
                </div>
                <ul className="divide-y divide-border">
                  {g.accounts.map((a) => (
                    <li key={a.id}>
                      <Link
                        href={`/cockpit/kunden/${a.id}`}
                        className="flex items-center justify-between gap-2 py-1.5 hover:opacity-80"
                      >
                        <span className="min-w-0">
                          <span className="truncate text-sm font-medium text-ink">{a.name}</span>
                          <span className="block truncate text-xs text-faint">
                            {[a.contact_email, a.ort, a.lifecycle].filter(Boolean).join(" · ")}
                          </span>
                        </span>
                        <IconChevronRight size={14} className="flex-none text-faint" />
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        ) : null}
      </CardBody>
    </Card>
  );
}
