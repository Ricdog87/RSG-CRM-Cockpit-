import { ImageResponse } from "next/og";

/**
 * Rendert das RSG-Marken-Icon (Blau→Sky-Verlauf, „RSG" in Weiß) als PNG.
 * Wird von /api/icon (Manifest, mit Query) und /apple-icon (sauberer Pfad) genutzt.
 *
 * @param size     Kantenlänge in px
 * @param maskable volle Fläche + Safe-Zone für Android-Adaptive-Icons
 */
export function renderBrandIcon(size: number, maskable: boolean): ImageResponse {
  // Maskable braucht eine Safe-Zone (~10 % Rand), „any"/Apple darf abgerundet sein.
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
          // Volle, undurchsichtige Fläche – iOS mag keine Transparenz.
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
