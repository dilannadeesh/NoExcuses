/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        courtink: "#0F2427",
        "courtink-2": "#0A1A1C",
        court: "#1F6F5C",
        "court-light": "#2E9179",
        chalk: "#F4F1E8",
        amber: "#E8A33D",
        slate: "#7E9695",
        fault: "#C1483B",
      },
      fontFamily: {
        display: ["'Big Shoulders Display'", "sans-serif"],
        body: ["Inter", "sans-serif"],
        mono: ["'IBM Plex Mono'", "monospace"],
      },
    },
  },
  plugins: [],
};
