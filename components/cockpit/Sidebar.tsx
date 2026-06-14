"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAV_GROUPS } from "@/lib/nav";
import { IconLogout } from "@/components/ui/icons";
import { cn } from "@/components/ui/cn";

function isActive(pathname: string, href: string) {
  return href === "/cockpit" ? pathname === "/cockpit" : pathname.startsWith(href);
}

/** Persistente Desktop-Sidebar (links). */
export function Sidebar({ partnerName }: { partnerName: string }) {
  const pathname = usePathname();
  const initials = partnerName
    .split(" ")
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <aside className="sticky top-0 hidden h-screen w-64 flex-none flex-col border-r border-border bg-surface/80 px-4 py-5 backdrop-blur-xl lg:flex">
      <Link href="/cockpit" className="mb-8 flex items-center gap-2.5 px-2">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-purple to-cyan text-sm font-black text-white shadow-glow">
          RSG
        </span>
        <span className="flex flex-col leading-tight">
          <span className="text-sm font-bold text-ink">RSG CRM</span>
          <span className="text-[0.7rem] text-faint">Partner-Cockpit</span>
        </span>
      </Link>

      <nav className="flex flex-1 flex-col gap-5 overflow-y-auto">
        {NAV_GROUPS.map((group, gi) => (
          <div key={group.label ?? gi} className="flex flex-col gap-1">
            {group.label ? (
              <p className="px-3 pb-1 text-[0.62rem] font-semibold uppercase tracking-[0.16em] text-faint">
                {group.label}
              </p>
            ) : null}
            {group.items.map((item) => {
              const active = isActive(pathname, item.href);
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  data-active={active}
                  className="nav-link group"
                >
                  <Icon
                    size={19}
                    className={cn(
                      active ? "text-purple-deep" : "text-faint group-hover:text-muted"
                    )}
                  />
                  <span>{item.label}</span>
                  {active ? (
                    <span className="ml-auto h-1.5 w-1.5 rounded-full bg-cyan" />
                  ) : null}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      <div className="mt-4 border-t border-border/70 pt-4">
        <div className="flex items-center gap-3 px-2">
          <span className="flex h-9 w-9 flex-none items-center justify-center rounded-full bg-elevated text-xs font-bold text-ink ring-1 ring-border">
            {initials || "RS"}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-ink">{partnerName}</p>
            <p className="text-[0.7rem] text-faint">Vertriebspartner:in</p>
          </div>
          <form action="/cockpit/auth/signout" method="post">
            <button
              type="submit"
              aria-label="Abmelden"
              className="rounded-lg p-2 text-faint transition-colors hover:bg-elevated hover:text-ink"
            >
              <IconLogout size={18} />
            </button>
          </form>
        </div>
      </div>
    </aside>
  );
}
