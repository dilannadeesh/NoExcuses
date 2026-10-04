/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        canvas: "#F3F5FA",
        ink: "#0D1117",
        muted: "#667085",
        faint: "#98A2B3",
        line: "#E4E8F1",
        soft: "#F2F4F9",
        brand: { DEFAULT: "#2F6BFF", soft: "#E7EEFF", light: "#6EA8FF" },
        blush: { DEFAULT: "#FBDCE7", deep: "#F6B8CF" },
        win: { DEFAULT: "#12A150", soft: "#DDF6E7" },
        loss: { DEFAULT: "#E5484D", soft: "#FDE5E5" },
        warn: { DEFAULT: "#B26A00", soft: "#FFF1D6" },
        // podium
        gold: { DEFAULT: "#F2B53B", soft: "#FFF3D6" },
        silver: { DEFAULT: "#A9B4C4", soft: "#EDF0F5" },
        bronze: { DEFAULT: "#CD8450", soft: "#F9E8DC" },
      },
      fontFamily: {
        sans: ["Inter", "ui-sans-serif", "system-ui", "-apple-system", "Segoe UI", "sans-serif"],
      },
      boxShadow: {
        card: "0 1px 2px rgba(16,24,40,.04), 0 10px 30px -14px rgba(40,70,140,.22)",
        float: "0 10px 34px -8px rgba(16,24,40,.30)",
      },
    },
  },
  plugins: [],
};
