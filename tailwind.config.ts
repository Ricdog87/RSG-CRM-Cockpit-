import type { Config } from "tailwindcss";

/**
 * RSG Marken-Tokens. Bewusst schlank gehalten — ein einziges,
 * konsistentes Set für das Partner-Cockpit. Dunkler Grund (#09090f),
 * Purple (#a855f7) und Cyan (#22d3ee) als Akzente.
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
        // Hintergründe
        base: "#09090f",
        surface: "#0f0f17",
        elevated: "#15151f",
        border: "#22222e",
        // Text
        ink: "#f4f4f5",
        muted: "#a1a1aa",
        faint: "#71717a",
        // Marke
        purple: {
          DEFAULT: "#a855f7",
          soft: "#c084fc",
          deep: "#7e22ce",
        },
        cyan: {
          DEFAULT: "#22d3ee",
          soft: "#67e8f9",
          deep: "#0e7490",
        },
        // Status
        success: "#34d399",
        warning: "#fbbf24",
        danger: "#fb7185",
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
        glow: "0 0 0 1px rgba(168,85,247,0.18), 0 18px 60px -20px rgba(168,85,247,0.45)",
        card: "0 1px 0 0 rgba(255,255,255,0.03) inset, 0 18px 50px -28px rgba(0,0,0,0.9)",
      },
      backgroundImage: {
        "brand-glow":
          "radial-gradient(60% 80% at 20% 0%, rgba(168,85,247,0.16), transparent 60%), radial-gradient(50% 70% at 90% 10%, rgba(34,211,238,0.12), transparent 60%)",
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
