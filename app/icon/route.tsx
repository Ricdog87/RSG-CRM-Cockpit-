import { renderBrandIcon } from "@/lib/icon-image";

export const runtime = "edge";

/** Favicon / Browser-Icon (192×192) unter sauberem Pfad /icon. */
export function GET() {
  return renderBrandIcon(192, false);
}
