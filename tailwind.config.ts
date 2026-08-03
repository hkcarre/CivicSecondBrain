import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // Official Strata Civic Solutions brand palette (exact values from
        // brand guidelines) plus computed light/dark tints for hover states
        // and dark-mode contrast, which the guide doesn't specify directly —
        // derived by mixing toward white/black rather than eyeballed, see
        // git history for the exact mix ratios.
        city: {
          navy: "#081A33", // Deep Navy
          "navy-light": "#3e4c60", // hover state
          "navy-dark-text": "#9098a3", // navy family, lightened for legibility as text/accent on dark surfaces
          maroon: "#8B1E2D", // Dark Civic Red
          "maroon-dark": "#681722", // hover state (light mode buttons)
          "maroon-light": "#ae626c", // dark-mode accent contrast
          cream: "#F4EFE4", // Cream
          "light-blue": "#8FA9C4", // Light Blue — brand's own dark-mode-friendly accent
          charcoal: "#2B2B2B", // Charcoal
        },
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};

export default config;
