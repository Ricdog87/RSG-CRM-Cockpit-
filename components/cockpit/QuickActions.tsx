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
  { label: "Aufgaben", href: "/cockpit/aufgaben", icon: IconTasks },
  { label: "Kandidaten", href: "/cockpit/kandidaten", icon: IconUsers },
  { label: "Kunden", href: "/cockpit/kunden", icon: IconBriefcase },
  { label: "Leads", href: "/cockpit/leads", icon: IconSpark },
  { label: "Chancen", href: "/cockpit/sales", icon: IconTrophy },
  { label: "Berichte", href: "/cockpit/berichte", icon: IconChart },
] as const;

/** Schnellzugriff-Leiste – oben im Dashboard als HubSpot-Ersatz. */
export function QuickActions() {
  return (
    <Card>
      <CardBody className="p-3">
        <div className="flex items-center gap-1">
          {QUICK_ACTIONS.map(({ label, href, icon: Icon }) => (
            <Link
              key={label}
              href={href}
              className="group flex flex-1 flex-col items-center gap-1.5 rounded-xl px-2 py-3 transition-colors hover:bg-surface"
            >
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-elevated text-muted transition-all group-hover:scale-110 group-hover:bg-brand/10 group-hover:text-brand-deep">
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
