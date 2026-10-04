// Deterministic, low-saturation identity for a name, so the same person or
// group always gets the same tone everywhere it appears.
const PALETTES = [
  "bg-[#E8EEFB] text-[#2B4A9B]",
  "bg-[#E6F3EC] text-[#2A6B4B]",
  "bg-[#F6EAEA] text-[#9B3B3B]",
  "bg-[#F0EBF8] text-[#5B3FA0]",
  "bg-[#FBF0DF] text-[#8A5A12]",
  "bg-[#E7F1F5] text-[#255F78]",
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
      className={`inline-grid shrink-0 place-items-center font-semibold ${paletteFor(name)} ${
        shape === "tile" ? "rounded-xl" : "rounded-full"
      } ${className}`}
    >
      {initials(name)}
    </span>
  );
}
