"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAV_ITEMS, MOBILE_NAV_HREFS } from "@/lib/nav";
import { cn } from "@/components/ui/cn";

function isActive(pathname: string, href: string) {
  return href === "/cockpit" ? pathname === "/cockpit" : pathname.startsWith(href);
}

const MOBILE_ITEMS = MOBILE_NAV_HREFS.map(
  (href) => NAV_ITEMS.find((i) => i.href === href)!
).filter(Boolean);

/** Untere Tab-Bar für Mobile (≤ lg) – kuratierte Primär-Einträge. */
export function MobileNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-border/70 bg-surface/95 pb-safe backdrop-blur-xl lg:hidden">
      <ul className="mx-auto flex max-w-lg items-stretch justify-between px-1.5 pt-1.5">
        {MOBILE_ITEMS.map((item) => {
          const active = isActive(pathname, item.href);
          const Icon = item.icon;
          return (
            <li key={item.href} className="flex-1">
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className="group flex flex-col items-center gap-1 px-1 pb-2 pt-1 text-[0.62rem] font-medium"
              >
                <span
                  className={cn(
                    "relative flex h-9 w-full max-w-[3.5rem] items-center justify-center rounded-xl transition-all duration-200",
                    active
                      ? "bg-brand/10 text-brand-deep"
                      : "text-faint group-active:bg-elevated"
                  )}
                >
                  {active ? (
                    <span className="absolute -top-1.5 h-1 w-6 rounded-full bg-gradient-to-r from-brand to-sky" />
                  ) : null}
                  <Icon size={21} />
                </span>
                <span
                  className={cn(
                    "truncate transition-colors",
                    active ? "text-brand-deep" : "text-faint"
                  )}
                >
                  {item.label}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
