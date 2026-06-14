import { renderBrandIcon } from "@/lib/icon-image";

export const runtime = "edge";

/**
 * Apple-Touch-Icon (180×180) unter sauberem Pfad /apple-icon.
 * iOS lädt Touch-Icons mit Query-String oft NICHT – daher ohne Query.
 */
export function GET() {
  return renderBrandIcon(180, false);
}
