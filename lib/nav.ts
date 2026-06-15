import {
  IconDashboard,
  IconSpark,
  IconBolt,
  IconCalendar,
  IconTasks,
  IconTarget,
  IconUsers,
  IconMail,
  IconLayers,
  IconPhone,
  IconBriefcase,
  IconUserCheck,
  IconNetwork,
  IconChart,
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
  {
    label: "Vertrieb",
    items: [
      {
        href: "/cockpit/sales",
        label: "Sales-Pipeline",
        icon: IconTarget,
        description: "Projekt-Chancen über beide Geschäftslinien",
      },
      {
        href: "/cockpit/kunden",
        label: "Kunden",
        icon: IconUsers,
        description: "Accounts, Kontakte und Lifecycle",
      },
      {
        href: "/cockpit/postfach",
        label: "Postfach",
        icon: IconMail,
        description: "BCC-E-Mail-Tracking je Kunde",
      },
      {
        href: "/cockpit/segmente",
        label: "Segmente",
        icon: IconLayers,
        description: "KI-Zielgruppen und Use-Cases",
      },
      {
        href: "/cockpit/berichte",
        label: "Berichte",
        icon: IconChart,
        description: "Funnel, Forecast und Kennzahlen",
      },
    ],
  },
  {
    label: "Projekte",
    items: [
      {
        href: "/cockpit/projekte/ki",
        label: "KI & Telefonassistenz",
        icon: IconPhone,
        description: "Umsetzung und Betrieb der KI-Projekte",
      },
      {
        href: "/cockpit/projekte/recruiting",
        label: "Personalvermittlung",
        icon: IconBriefcase,
        description: "Recruiting-Mandate und Besetzungen",
      },
      {
        href: "/cockpit/kandidaten",
        label: "Kandidaten",
        icon: IconUserCheck,
        description: "Recruiting-Pipeline der Kandidat:innen",
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
  "/cockpit/kunden",
  "/cockpit/kandidaten",
  "/cockpit/sales",
  "/cockpit/aufgaben",
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
