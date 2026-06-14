import type { Config } from "tailwindcss";

/**
 * RSG Marken-Tokens – helles, professionelles CRM-Theme.
 * Weiße Cards auf hellem Canvas, RSG-Akzente Purple (#a855f7) und
 * Cyan (#22d3ee) gezielt eingesetzt. Tiefere Varianten (deep/ink) sorgen
 * für lesbaren Text auf hellen Flächen.
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
        base: "#f5f7fb", // App-Canvas
        surface: "#ffffff", // Cards
        elevated: "#eef1f7", // Inputs / dezente Füllungen
        border: "#e2e6ef", // Hairlines
        // Text
        ink: "#0f172a", // primär
        muted: "#48566b", // sekundär
        faint: "#6b7689", // tertiär
        // Marke
        purple: {
          DEFAULT: "#a855f7",
          soft: "#c084fc",
          deep: "#7c3aed",
          ink: "#6d28d9",
        },
        cyan: {
          DEFAULT: "#22d3ee",
          soft: "#67e8f9",
          deep: "#0891b2",
          ink: "#0e7490",
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
        glow: "0 1px 2px rgba(124,58,237,0.08), 0 16px 40px -16px rgba(124,58,237,0.30)",
        card: "0 1px 2px rgba(16,24,40,0.04), 0 10px 28px -16px rgba(16,24,40,0.18)",
      },
      backgroundImage: {
        "brand-glow":
          "radial-gradient(55% 70% at 12% -5%, rgba(168,85,247,0.10), transparent 55%), radial-gradient(45% 55% at 100% 0%, rgba(34,211,238,0.10), transparent 55%)",
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
