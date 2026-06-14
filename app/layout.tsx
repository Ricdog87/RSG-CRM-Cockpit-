import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "RSG Partner-Cockpit",
  description:
    "Dein wachsender wiederkehrender Bestand, Provisionen, Pipeline und Team – auf einen Blick.",
};

export const viewport: Viewport = {
  themeColor: "#09090f",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="de">
      <body className="min-h-screen bg-base font-sans">{children}</body>
    </html>
  );
}
