// Podium styling for ranks 1-3, shared by every ranking list so they can't drift.
const MEDALS = {
  1: { badge: "bg-gold text-onlime", row: "bg-gold-soft" },
  2: { badge: "bg-silver text-onlime", row: "bg-silver-soft" },
  3: { badge: "bg-bronze text-onlime", row: "bg-bronze-soft" },
};

export function medalFor(rank) {
  return MEDALS[rank] || null;
}

export default function RankBadge({ rank }) {
  const medal = MEDALS[rank];
  if (!medal) {
    return <span className="num inline-block w-6 text-center text-sm font-semibold text-faint">{rank}</span>;
  }
  return (
    <span
      aria-label={`Rank ${rank}`}
      className={`num inline-grid h-6 w-6 place-items-center rounded-full text-xs font-bold ${medal.badge}`}
    >
      {rank}
    </span>
  );
}
