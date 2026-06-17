import Link from "next/link";
import { Card, CardBody } from "@/components/ui/Card";
import {
  IconTasks,
  IconUsers,
  IconBriefcase,
  IconTrophy,
  IconChart,
  IconSpark,
} from "@/components/ui/icons";

const QUICK_ACTIONS = [
  {
    label: "Aufgaben",
    href: "/cockpit/aufgaben",
    icon: IconTasks,
    accent: "text-blue-500 bg-blue-500/10",
  },
  {
    label: "Kandidaten",
    href: "/cockpit/kandidaten",
    icon: IconUsers,
    accent: "text-emerald-500 bg-emerald-500/10",
  },
  {
    label: "Kunden",
    href: "/cockpit/kunden",
    icon: IconBriefcase,
    accent: "text-violet-500 bg-violet-500/10",
  },
  {
    label: "Leads",
    href: "/cockpit/leads",
    icon: IconSpark,
    accent: "text-sky-500 bg-sky-500/10",
  },
  {
    label: "Chancen",
    href: "/cockpit/sales",
    icon: IconTrophy,
    accent: "text-amber-500 bg-amber-500/10",
  },
  {
    label: "Berichte",
    href: "/cockpit/berichte",
    icon: IconChart,
    accent: "text-rose-500 bg-rose-500/10",
  },
] as const;

/** Schnellzugriff-Leiste – oben im Dashboard als HubSpot-Ersatz. */
export function QuickActions() {
  return (
    <Card>
      <CardBody className="p-3">
        <div className="flex items-center gap-1">
          {QUICK_ACTIONS.map(({ label, href, icon: Icon, accent }) => (
            <Link
              key={label}
              href={href}
              className="group flex flex-1 flex-col items-center gap-1.5 rounded-xl px-2 py-3 transition-colors hover:bg-surface"
            >
              <div
                className={`flex h-9 w-9 items-center justify-center rounded-xl ${accent} transition-transform group-hover:scale-110`}
              >
                <Icon size={17} />
              </div>
              <span className="text-[11px] font-medium text-muted group-hover:text-ink">
                {label}
              </span>
            </Link>
          ))}
        </div>
      </CardBody>
    </Card>
  );
}
