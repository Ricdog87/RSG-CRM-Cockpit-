import type { Config } from "tailwindcss";

/**
 * RSG Marken-Tokens – helles, professionelles CRM-Theme in Blau/Weiß/Grau.
 * Weiße Cards auf hellem Grau-Canvas, Blau (#2563eb) als Primärakzent,
 * Sky-Blau (#0ea5e9) sekundär. Tiefere Varianten (deep/ink) für lesbaren
 * Text auf hellen Flächen.
 */
const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Flächen
        base: "#f4f6fa", // App-Canvas (hellgrau)
        surface: "#ffffff", // Cards
        elevated: "#eef1f6", // Inputs / dezente Füllungen
        border: "#e1e6ee", // Hairlines
        // Text
        ink: "#0f1b2d", // primär (dunkles Navy-Slate)
        muted: "#44516a", // sekundär
        faint: "#6b7689", // tertiär
        // Marke – Blau
        brand: {
          DEFAULT: "#2563eb",
          soft: "#60a5fa",
          deep: "#1d4ed8",
          ink: "#1e40af",
        },
        // Sekundär – Sky-Blau
        sky: {
          DEFAULT: "#0ea5e9",
          soft: "#38bdf8",
          deep: "#0284c7",
          ink: "#0369a1",
        },
        // Status (dunkel genug für Text auf hellem Tint)
        success: "#15803d",
        warning: "#b45309",
        danger: "#dc2626",
      },
      fontFamily: {
        sans: [
          "var(--font-sans)",
          "ui-sans-serif",
          "system-ui",
          "-apple-system",
          "Segoe UI",
          "Roboto",
          "sans-serif",
        ],
      },
      borderRadius: {
        xl: "0.875rem",
        "2xl": "1.25rem",
      },
      boxShadow: {
        glow: "0 1px 2px rgba(37,99,235,0.08), 0 16px 40px -16px rgba(37,99,235,0.30)",
        card: "0 1px 2px rgba(15,27,45,0.04), 0 10px 28px -16px rgba(15,27,45,0.16)",
      },
      backgroundImage: {
        "brand-glow":
          "radial-gradient(55% 70% at 12% -5%, rgba(37,99,235,0.10), transparent 55%), radial-gradient(45% 55% at 100% 0%, rgba(14,165,233,0.09), transparent 55%)",
      },
      keyframes: {
        "fade-up": {
          "0%": { opacity: "0", transform: "translateY(8px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        shimmer: {
          "100%": { transform: "translateX(100%)" },
        },
      },
      animation: {
        "fade-up": "fade-up 0.4s ease-out both",
        shimmer: "shimmer 1.6s infinite",
      },
    },
  },
  plugins: [],
};

export default config;
