import {
  IconDashboard,
  IconPipeline,
  IconUsers,
  IconNetwork,
  IconEuro,
  IconTrophy,
} from "@/components/ui/icons";

export interface NavItem {
  href: string;
  label: string;
  icon: (p: { size?: number; className?: string }) => JSX.Element;
  /** Kurzbeschreibung für die Seiten-Kopfzeile */
  description: string;
}

/** Hauptnavigation des RSG-CRM. Reihenfolge = Sidebar-Reihenfolge. */
export const NAV_ITEMS: NavItem[] = [
  {
    href: "/cockpit",
    label: "Übersicht",
    icon: IconDashboard,
    description: "Dein wachsender Bestand auf einen Blick",
  },
  {
    href: "/cockpit/pipeline",
    label: "Pipeline",
    icon: IconPipeline,
    description: "Offene Deals und gewichtetes Potenzial",
  },
  {
    href: "/cockpit/kunden",
    label: "Kunden",
    icon: IconUsers,
    description: "Dein aktiver Bestand und Onboarding",
  },
  {
    href: "/cockpit/team",
    label: "Team",
    icon: IconNetwork,
    description: "Deine Downline und ihr Bestand",
  },
  {
    href: "/cockpit/provisionen",
    label: "Provisionen",
    icon: IconEuro,
    description: "Auszahlungen, Reserve und Override",
  },
  {
    href: "/cockpit/karriere",
    label: "Karriere",
    icon: IconTrophy,
    description: "Stufenplan, Override-Ebenen und Leaderboard",
  },
];

/** Findet den aktiven Nav-Eintrag zum aktuellen Pfad (längster Präfix-Match). */
export function activeNavItem(pathname: string): NavItem {
  const sorted = [...NAV_ITEMS].sort((a, b) => b.href.length - a.href.length);
  return (
    sorted.find((i) =>
      i.href === "/cockpit"
        ? pathname === "/cockpit"
        : pathname.startsWith(i.href)
    ) ?? NAV_ITEMS[0]
  );
}
