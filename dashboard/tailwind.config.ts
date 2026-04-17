import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // Precision Darkness Background Stack (Issue #76)
        void: "#020408",
        deep: "#05080F",
        surface: "#080D18",
        raised: "#0C1220",
        lifted: "#101828",
        
        // Brand Blue Palette (6 stops)
        blue: {
          50: "#E6F4FF",
          100: "#B3DEFF",
          200: "#80C8FF",
          300: "#4DB2FF",
          400: "#1E90FF",
          500: "#1873CC",
          600: "#125699",
        },
        
        // Text Hierarchy (4 levels)
        text: {
          primary: "#F0F4F8",
          secondary: "#94A3B8",
          muted: "#64748B",
          dimmed: "#475569",
        },
        
        // Legacy tokens (keep for compatibility during transition)
        background: "var(--background)",
        foreground: "var(--foreground)",
        card: {
          DEFAULT: "var(--card)",
          border: "var(--card-border)",
        },
        primary: {
          DEFAULT: "#1E90FF",
          dark: "#1873CC",
          light: "#4BA6FF",
        },
        success: "#00ff88",
        warning: "#ffaa00",
        error: "#ff4444",
        xdc: {
          bg: "#0a0a1a",
          card: "#151530",
          border: "#2a2a50",
          blue: "#1E90FF",
        },
      },
      fontFamily: {
        sans: ["var(--font-dm-sans)", "var(--font-fira-sans)", "system-ui", "sans-serif"],
        mono: ["var(--font-jetbrains-mono)", "var(--font-fira-code)", "monospace"],
        heading: ["var(--font-dm-sans)", "system-ui", "sans-serif"],
      },
      animation: {
        "spin-slow": "spin 3s linear infinite",
        pulse: "pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite",
      },
      backdropBlur: {
        xs: "2px",
      },
    },
  },
  plugins: [],
};

export default config;
