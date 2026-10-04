// Podium styling for ranks 1-3, shared by every ranking list so the tile and
// the full standings table stay consistent. Gold is the app's amber.
const MEDALS = {
  1: { badge: "bg-amber text-courtink", row: "bg-amber/10", name: "text-chalk font-semibold" },
  2: { badge: "bg-silver text-courtink", row: "bg-silver/10", name: "text-chalk font-semibold" },
  3: { badge: "bg-bronze text-courtink", row: "bg-bronze/10", name: "text-chalk font-semibold" },
};

export function medalFor(rank) {
  return MEDALS[rank] || null;
}

export default function RankBadge({ rank }) {
  const medal = MEDALS[rank];
  if (!medal) {
    return <span className="scoreboard-digit text-slate inline-block w-5 text-right">{rank}</span>;
  }
  return (
    <span
      aria-label={`Rank ${rank}`}
      className={`scoreboard-digit inline-flex items-center justify-center w-5 h-5 rounded-full text-[11px] font-bold ${medal.badge}`}
    >
      {rank}
    </span>
  );
}
