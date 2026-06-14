import { renderBrandIcon } from "@/lib/icon-image";

export const runtime = "edge";

/**
 * RSG-App-Icon als PNG für das Web-App-Manifest (Android).
 * Query: ?size=192|512 · ?maskable=1 (volle Fläche, Logo in der Safe-Zone).
 */
export function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const size = Math.min(1024, Math.max(48, Number(searchParams.get("size")) || 512));
  const maskable = searchParams.get("maskable") === "1";
  return renderBrandIcon(size, maskable);
}
