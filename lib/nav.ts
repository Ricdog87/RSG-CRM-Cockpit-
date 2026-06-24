import {
  IconDashboard,
  IconSpark,
  IconBolt,
  IconCalendar,
  IconTasks,
  IconUserCheck,
  IconNetwork,
  IconEuro,
  IconTrophy,
  IconSettings,
  IconFolder,
  IconCheck,
} from "@/components/ui/icons";

export interface NavItem {
  href: string;
  label: string;
  icon: (p: { size?: number; className?: string }) => JSX.Element;
  description: string;
}

export interface NavGroup {
  label?: string;
  items: NavItem[];
}

/** Gruppierte Hauptnavigation des RSG-CRM. */
export const NAV_GROUPS: NavGroup[] = [
  {
    items: [
      {
        href: "/cockpit",
        label: "Übersicht",
        icon: IconDashboard,
        description: "Dein wachsender Bestand auf einen Blick",
      },
      {
        href: "/cockpit/leads",
        label: "Lead Intelligence",
        icon: IconSpark,
        description: "KI-Bewertung neuer B2B-Leads",
      },
      {
        href: "/cockpit/kalender",
        label: "Kalender",
        icon: IconCalendar,
        description: "Termine & Aufgaben, Google-/Outlook-Abo",
      },
      {
        href: "/cockpit/aufgaben",
        label: "Aufgaben",
        icon: IconTasks,
        description: "Alle offenen Aufgaben nach Fälligkeit",
      },
      {
        href: "/cockpit/automatisierungen",
        label: "Automatisierungen",
        icon: IconBolt,
        description: "Regelbasierte Workflows im Hintergrund",
      },
      {
        href: "/cockpit/import",
        label: "Import",
        icon: IconFolder,
        description: "CSV-Direktimport für Kunden, Kandidaten & mehr",
      },
    ],
  },
  // Pivot zur Kandidaten-DB: Kunden/Deals/Projekte leben künftig in HubSpot
  // und sind hier aus der Navigation ausgeblendet (Seiten/Daten bleiben per
  // URL erreichbar, nichts gelöscht).
  {
    label: "Kandidaten",
    items: [
      {
        href: "/cockpit/kandidaten",
        label: "Kandidaten",
        icon: IconUserCheck,
        description: "Datenschutz-konforme Kandidaten-Datenbank",
      },
      {
        href: "/cockpit/match",
        label: "Search & Match",
        icon: IconSpark,
        description: "HubSpot-Projekt → passende, einwilligungsgeprüfte Kandidaten",
      },
      {
        href: "/cockpit/einwilligungen",
        label: "Einwilligungen",
        icon: IconCheck,
        description: "DSGVO-Einwilligungen der Kandidat:innen",
      },
    ],
  },
  {
    label: "Partner",
    items: [
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
      {
        href: "/cockpit/einstellungen",
        label: "Einstellungen",
        icon: IconSettings,
        description: "Profil, Verbindungen und BCC-Adresse",
      },
    ],
  },
];

/** Flache Liste aller Nav-Einträge (für Aktiv-Match und Mobile-Bar). */
export const NAV_ITEMS: NavItem[] = NAV_GROUPS.flatMap((g) => g.items);

/** Kuratiierte Primär-Einträge für die Mobile-Tab-Bar. */
export const MOBILE_NAV_HREFS = [
  "/cockpit",
  "/cockpit/kandidaten",
  "/cockpit/einwilligungen",
  "/cockpit/aufgaben",
  "/cockpit/kalender",
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
