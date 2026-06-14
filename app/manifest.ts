import type { MetadataRoute } from "next";

/**
 * PWA-Manifest: macht das RSG-CRM auf Mobile installierbar (Add to Home Screen)
 * und startet es vollflächig (standalone) mit RSG-Logo und Marken-Farben.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "RSG CRM · Partner-Cockpit",
    short_name: "RSG CRM",
    description:
      "Das hausinterne RSG-CRM: Bestand, Provisionen, Pipeline, Kunden, Team und Karriere – an einem Ort.",
    id: "/cockpit",
    start_url: "/cockpit",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#f4f6fa",
    theme_color: "#ffffff",
    lang: "de",
    categories: ["business", "productivity"],
    icons: [
      { src: "/api/icon?size=192", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/api/icon?size=512", sizes: "512x512", type: "image/png", purpose: "any" },
      {
        src: "/api/icon?size=512&maskable=1",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
