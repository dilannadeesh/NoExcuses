/** @type {import('tailwindcss').Config} */
// "Night court" theme: near-black green surfaces, neon-lime accent, heavy italic
// display type. Token names are unchanged from the old light theme so every
// screen picks the new look up automatically.
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        canvas: "#060A08",
        surface: "#0E1612",
        raised: "#14201A",
        ink: "#F3F7F1",
        muted: "#9FB0A5",
        faint: "#6E8075",
        line: "#1F2D25",
        soft: "#16221B",
        lime: { DEFAULT: "#CCF53C", dim: "#A8D11E", soft: "#1B2A0E" },
        onlime: "#0A1206",
        brand: { DEFAULT: "#CCF53C", soft: "#1A260E" },
        win: { DEFAULT: "#4ADE80", soft: "#0F2619" },
        loss: { DEFAULT: "#FF6B6B", soft: "#2B1315" },
        warn: { DEFAULT: "#FBBF24", soft: "#2B2008" },
        // podium
        gold: { DEFAULT: "#F5B73B", soft: "#2A2108" },
        silver: { DEFAULT: "#B4C0CC", soft: "#1D2429" },
        bronze: { DEFAULT: "#D58A4B", soft: "#2A1B10" },
      },
      fontFamily: {
        sans: ["Inter", "ui-sans-serif", "system-ui", "-apple-system", "Segoe UI", "sans-serif"],
        display: ['"Barlow Condensed"', "Impact", "ui-sans-serif", "system-ui", "sans-serif"],
      },
      boxShadow: {
        card: "0 1px 0 rgba(255,255,255,.04) inset, 0 8px 24px -12px rgba(0,0,0,.7)",
        glow: "0 0 0 1px rgba(204,245,60,.35), 0 8px 28px -8px rgba(204,245,60,.45)",
      },
    },
  },
  plugins: [],
};
