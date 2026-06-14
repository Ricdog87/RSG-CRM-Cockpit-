import { Badge } from "@/components/ui/Badge";
import type { BusinessLine } from "@/lib/crm-types";

/** Kennzeichnet die Geschäftslinie (KI vs. Recruiting). */
export function LineBadge({ line }: { line: BusinessLine }) {
  return line === "ki" ? (
    <Badge tone="cyan">KI</Badge>
  ) : (
    <Badge tone="purple">Recruiting</Badge>
  );
}
