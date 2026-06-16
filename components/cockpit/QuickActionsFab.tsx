"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import {
  IconPlus,
  IconUsers,
  IconTarget,
  IconCalendar,
  IconSpark,
  IconBriefcase,
  IconPhone,
} from "@/components/ui/icons";
import { cn } from "@/components/ui/cn";

interface Action {
  label: string;
  href: string;
  icon: (p: { size?: number; className?: string }) => JSX.Element;
  accent: string;
}

// Deeplinks: ?new=1 öffnet auf der Zielseite automatisch den passenden Dialog.
const ACTIONS: Action[] = [
  { label: "Recruiting-Auftrag", href: "/cockpit/projekte/recruiting?new=1", icon: IconBriefcase, accent: "bg-brand-deep" },
  { label: "KI-Auftrag", href: "/cockpit/projekte/ki?new=1", icon: IconPhone, accent: "bg-sky-deep" },
  { label: "Kunde", href: "/cockpit/kunden?new=1", icon: IconUsers, accent: "bg-brand" },
  { label: "Verkaufschance", href: "/cockpit/sales?new=1", icon: IconTarget, accent: "bg-sky" },
  { label: "Termin / Aufgabe", href: "/cockpit/kalender?new=1", icon: IconCalendar, accent: "bg-success" },
  { label: "Lead-Analyse", href: "/cockpit/leads", icon: IconSpark, accent: "bg-ink" },
];

/**
 * Schwebender Schnellaktions-Button (nur Mobile, ≤ lg).
 * Tippen öffnet einen Speed-Dial mit den häufigsten „Anlegen"-Aktionen.
 */
export function QuickActionsFab() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  // Beim Seitenwechsel schließen.
  useEffect(() => setOpen(false), [pathname]);

  return (
    <div className="lg:hidden">
      {/* Backdrop zum Schließen */}
      {open ? (
        <button
          type="button"
          aria-label="Schließen"
          onClick={() => setOpen(false)}
          className="fixed inset-0 z-40 bg-ink/20 backdrop-blur-[2px] animate-fade-up"
        />
      ) : null}

      <div
        className="fixed right-4 z-50 flex flex-col items-end gap-3"
        style={{ bottom: "calc(5.5rem + env(safe-area-inset-bottom))" }}
      >
        {/* Speed-Dial-Einträge */}
        {open
          ? ACTIONS.map((a, i) => {
              const Icon = a.icon;
              return (
                <Link
                  key={a.href}
                  href={a.href}
                  onClick={() => setOpen(false)}
                  className="flex items-center gap-3 animate-fade-up"
                  style={{ animationDelay: `${i * 35}ms` }}
                >
                  <span className="rounded-lg bg-surface px-2.5 py-1 text-xs font-semibold text-ink shadow-card">
                    {a.label}
                  </span>
                  <span
                    className={cn(
                      "flex h-11 w-11 items-center justify-center rounded-full text-white shadow-glow",
                      a.accent
                    )}
                  >
                    <Icon size={20} />
                  </span>
                </Link>
              );
            })
          : null}

        {/* Haupt-Button */}
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-label={open ? "Schnellaktionen schließen" : "Schnell anlegen"}
          aria-expanded={open}
          className={cn(
            "flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-brand to-sky text-white shadow-glow transition-transform duration-200 active:scale-95",
            open && "rotate-45"
          )}
        >
          <IconPlus size={26} />
        </button>
      </div>
    </div>
  );
}
