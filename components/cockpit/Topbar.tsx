"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { activeNavItem } from "@/lib/nav";
import { IconBell, IconSearch } from "@/components/ui/icons";

/** Obere Leiste: aktueller Bereich + Suche + Mobile-Logo. */
export function Topbar({ partnerName }: { partnerName: string }) {
  const pathname = usePathname();
  const item = activeNavItem(pathname);
  const firstName = partnerName.split(" ")[0] || partnerName;
  const isOverview = item.href === "/cockpit";

  return (
    <header className="sticky top-0 z-30 border-b border-border bg-surface/80 backdrop-blur-xl">
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

        {/* Suche (dekorativ verdrahtet – CRM-weite Suche folgt) */}
        <label className="relative hidden items-center sm:flex">
          <IconSearch size={16} className="absolute left-3 text-faint" />
          <input
            type="search"
            placeholder="Kunden, Deals, Partner…"
            aria-label="Suche"
            className="w-44 rounded-xl border border-border bg-elevated/60 py-2 pl-9 pr-3 text-sm text-ink placeholder:text-faint focus-visible:ring-2 focus-visible:ring-sky lg:w-64"
          />
        </label>

        <button
          type="button"
          aria-label="Benachrichtigungen"
          className="relative rounded-xl border border-border bg-elevated/60 p-2 text-muted transition-colors hover:text-ink"
        >
          <IconBell size={18} />
          <span className="absolute right-2 top-2 h-1.5 w-1.5 rounded-full bg-sky" />
        </button>
      </div>
    </header>
  );
}
