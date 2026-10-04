/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        canvas: "#F6F7F9",
        ink: "#111827",
        muted: "#6B7280",
        faint: "#9CA3AF",
        line: "#E5E7EB",
        soft: "#F3F4F6",
        brand: { DEFAULT: "#2563EB", soft: "#EFF4FF" },
        win: { DEFAULT: "#15803D", soft: "#ECFDF3" },
        loss: { DEFAULT: "#B91C1C", soft: "#FEF2F2" },
        warn: { DEFAULT: "#B45309", soft: "#FFFAEB" },
        // podium
        gold: { DEFAULT: "#D99A1E", soft: "#FFF8E8" },
        silver: { DEFAULT: "#94A3B8", soft: "#F4F6F9" },
        bronze: { DEFAULT: "#B9773F", soft: "#FBF1E8" },
      },
      fontFamily: {
        sans: ["Inter", "ui-sans-serif", "system-ui", "-apple-system", "Segoe UI", "sans-serif"],
      },
      boxShadow: {
        card: "0 1px 2px rgba(16,24,40,.05)",
      },
    },
  },
  plugins: [],
};
