import type { Metadata, Viewport } from "next";
import { Poppins } from "next/font/google";
import "./globals.css";

const poppins = Poppins({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-sans",
  display: "swap",
});

export const metadata: Metadata = {
  title: "RSG CRM · Partner-Cockpit",
  description:
    "Das hausinterne RSG-CRM: wachsender Bestand, Provisionen, Pipeline, Kunden, Team und Karriere – an einem Ort.",
  applicationName: "RSG CRM",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "RSG CRM",
  },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  themeColor: "#ffffff",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="de" className={poppins.variable}>
      <body className="min-h-screen bg-base font-sans">{children}</body>
    </html>
  );
}
