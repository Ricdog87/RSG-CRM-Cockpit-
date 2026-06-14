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
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-border/70 bg-surface/90 backdrop-blur-xl lg:hidden">
      <ul className="mx-auto flex max-w-lg items-stretch justify-between px-1">
        {MOBILE_ITEMS.map((item) => {
          const active = isActive(pathname, item.href);
          const Icon = item.icon;
          return (
            <li key={item.href} className="flex-1">
              <Link
                href={item.href}
                className={cn(
                  "flex flex-col items-center gap-1 px-1 py-2.5 text-[0.62rem] font-medium transition-colors",
                  active ? "text-brand-deep" : "text-faint"
                )}
              >
                <Icon size={20} />
                <span className="truncate">{item.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
