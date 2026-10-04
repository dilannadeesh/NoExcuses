// Deterministic pastel-gradient identity for a name, so the same person or
// group always gets the same colour, everywhere it appears.
const PALETTES = [
  "from-[#7DB2FF] to-[#2F6BFF]",
  "from-[#B9A2FF] to-[#6D4AFF]",
  "from-[#62E3CF] to-[#0E9F8E]",
  "from-[#FFC785] to-[#F2711C]",
  "from-[#FFA3C7] to-[#E5367F]",
  "from-[#94E58F] to-[#16A34A]",
];

export function paletteFor(key = "") {
  let h = 0;
  for (const ch of String(key)) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return PALETTES[h % PALETTES.length];
}

export function initials(name = "") {
  const parts = String(name).trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 1).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

// shape: "circle" for people, "tile" for groups
export default function Avatar({ name, size = 40, shape = "circle", className = "" }) {
  return (
    <span
      aria-hidden="true"
      style={{ width: size, height: size, fontSize: Math.round(size * 0.38) }}
      className={`inline-grid shrink-0 place-items-center bg-gradient-to-br font-bold text-white ${paletteFor(name)} ${
        shape === "tile" ? "rounded-2xl" : "rounded-full"
      } ${className}`}
    >
      {initials(name)}
    </span>
  );
}
