import { ImageResponse } from "next/og";

export const runtime = "edge";

/**
 * Rendert das RSG-App-Icon als PNG (für Manifest, Apple-Touch, Favicon).
 * Query: ?size=192|512 · ?maskable=1 (volle Fläche, Logo in der Safe-Zone).
 *
 * Marken-Look: Blau→Sky-Verlauf, „RSG" in Weiß – identisch zur Sidebar.
 */
export function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const size = Math.min(1024, Math.max(48, Number(searchParams.get("size")) || 512));
  const maskable = searchParams.get("maskable") === "1";

  // Maskable braucht eine Safe-Zone (~10 % Rand), „any" darf abgerundet sein.
  const radius = maskable ? 0 : Math.round(size * 0.22);
  const pad = maskable ? Math.round(size * 0.14) : 0;
  const fontSize = Math.round((size - pad * 2) * 0.34);

  return new ImageResponse(
    (
      <div
        style={{
          display: "flex",
          width: "100%",
          height: "100%",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(135deg, #2563eb 0%, #0ea5e9 100%)",
        }}
      >
        <div
          style={{
            display: "flex",
            width: size - pad * 2,
            height: size - pad * 2,
            alignItems: "center",
            justifyContent: "center",
            borderRadius: radius,
            background: maskable
              ? "transparent"
              : "linear-gradient(135deg, #2563eb 0%, #0ea5e9 100%)",
          }}
        >
          <div
            style={{
              display: "flex",
              fontSize,
              fontWeight: 800,
              letterSpacing: -Math.round(fontSize * 0.04),
              color: "#ffffff",
              fontFamily: "sans-serif",
            }}
          >
            RSG
          </div>
        </div>
      </div>
    ),
    { width: size, height: size }
  );
}
