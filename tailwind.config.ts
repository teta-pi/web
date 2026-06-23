import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          violet: "#6B3FA0",
          orange: "#E8640C",
        },
        text: {
          primary: "#1A1035",
          authority: "#3A2C5C",
          secondary: "#6B6080",
          muted: "#9991AC",
          dot: "#D8D2E2",
        },
        level: {
          full: "#6B3FA0",
          partial: "#E8640C",
          registry: "#B8B2C8",
        },
        hairline: "rgba(26,16,53,0.10)",
        frosted: "rgba(107,63,160,0.025)",
        hover: "rgba(107,63,160,0.035)",
      },
      fontFamily: {
        sans: ["'Trebuchet MS'", "'Segoe UI'", "'Helvetica Neue'", "sans-serif"],
        mono: ["ui-monospace", "'SF Mono'", "Menlo", "monospace"],
      },
      borderRadius: {
        container: "13px",
        pill: "20px",
        chip: "4px",
      },
      maxWidth: {
        content: "880px",
        onboarding: "600px",
      },
      boxShadow: {
        none: "none",
      },
    },
  },
  plugins: [],
};

export default config;
