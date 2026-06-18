"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { activeNavItem } from "@/lib/nav";
import { Copilot } from "@/components/cockpit/Copilot";
import { OPEN_PALETTE_EVENT } from "@/components/cockpit/CommandPalette";
import { IconBell, IconSearch } from "@/components/ui/icons";

/** Obere Leiste: aktueller Bereich + Suche + Mobile-Logo. */
export function Topbar({
  partnerName,
  openTaskCount = 0,
  dueTaskCount = 0,
}: {
  partnerName: string;
  openTaskCount?: number;
  dueTaskCount?: number;
}) {
  const pathname = usePathname();
  const item = activeNavItem(pathname);
  const firstName = partnerName.split(" ")[0] || partnerName;
  const isOverview = item.href === "/cockpit";

  return (
    <header className="pt-safe sticky top-0 z-30 border-b border-border bg-surface/80 backdrop-blur-xl">
      <div className="flex items-center gap-3 px-4 py-3 sm:px-6">
        {/* Mobile-Logo */}
        <Link href="/cockpit" className="flex items-center gap-2 lg:hidden">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-brand to-sky text-xs font-black text-white">
            RSG
          </span>
        </Link>

        <div className="min-w-0 flex-1">
          <p className="eyebrow hidden sm:block">{isOverview ? `Hallo ${firstName}` : "RSG CRM"}</p>
          <h1 className="truncate text-base font-bold text-ink sm:text-lg">
            {isOverview ? "Übersicht" : item.label}
          </h1>
        </div>

        {/* CRM-weite Suche (Desktop/Tablet) → öffnet die Befehls-Palette (⌘K) */}
        <button
          type="button"
          onClick={() => window.dispatchEvent(new Event(OPEN_PALETTE_EVENT))}
          aria-label="Suche öffnen (⌘K)"
          className="relative hidden w-44 items-center gap-2 rounded-xl border border-border bg-elevated/60 py-2 pl-9 pr-3 text-sm text-faint transition-colors hover:text-muted sm:flex lg:w-64"
        >
          <IconSearch size={16} className="absolute left-3 text-faint" />
          <span className="flex-1 text-left">Suche…</span>
          <kbd className="rounded border border-border bg-surface px-1.5 py-0.5 text-[0.6rem] font-medium text-faint">
            ⌘K
          </kbd>
        </button>

        {/* Suche als Icon-Button (Mobile) */}
        <Link
          href="/cockpit/suche"
          aria-label="Suche"
          className="rounded-xl border border-border bg-elevated/60 p-2 text-muted transition-colors hover:text-ink sm:hidden"
        >
          <IconSearch size={18} />
        </Link>

        <Copilot />

        <Link
          href="/cockpit/aufgaben"
          aria-label={`Aufgaben & Benachrichtigungen${openTaskCount > 0 ? ` (${openTaskCount} offen)` : ""}`}
          className="relative rounded-xl border border-border bg-elevated/60 p-2 text-muted transition-colors hover:text-ink"
        >
          <IconBell size={18} />
          {openTaskCount > 0 ? (
            <span
              className={`absolute -right-1.5 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[0.6rem] font-bold text-white ${
                dueTaskCount > 0 ? "bg-warning" : "bg-sky"
              }`}
            >
              {openTaskCount > 9 ? "9+" : openTaskCount}
            </span>
          ) : null}
        </Link>
      </div>
    </header>
  );
}
