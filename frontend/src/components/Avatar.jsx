// Deterministic, low-saturation identity for a name, so the same person or
// group always gets the same tone everywhere it appears.
const PALETTES = [
  "bg-[#16263F] text-[#8FB4FF]",
  "bg-[#12301F] text-[#7FE0A6]",
  "bg-[#38181A] text-[#FF9A9A]",
  "bg-[#291F42] text-[#C2A9FF]",
  "bg-[#38280C] text-[#FFC966]",
  "bg-[#10303A] text-[#7FD3EC]",
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
