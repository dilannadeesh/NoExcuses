import { rankingValue } from "../lib/ranking";
import RankBadge, { medalFor } from "./RankBadge";

// How many players the dashboard tile lists; everyone else is behind the
// "Full standings" link.
const TOP_N = 8;

export default function TopPlayersTile({ playerStats, rankingMethod, onViewAll }) {
  const top = (playerStats || []).slice(0, TOP_N);

  return (
    <div className="relative w-full sm:flex-1 sm:min-w-[280px] rounded-sm bg-courtink-2 border border-white/5 px-5 py-4 overflow-hidden">
      <div className="absolute top-0 left-0 h-[3px] w-full bg-amber" />
      <div className="text-[11px] uppercase tracking-[0.18em] text-slate font-semibold mb-2">
        Top players
      </div>
      {top.length === 0 ? (
        <p className="text-sm text-slate py-1">No games logged yet.</p>
      ) : (
        <ol className="space-y-1">
          {top.map((p, i) => {
            const medal = medalFor(i + 1);
            return (
              <li
                key={p.id}
                className={`flex items-center gap-2 text-sm rounded-sm px-2 py-1 -mx-2 ${medal ? medal.row : ""}`}
              >
                <RankBadge rank={i + 1} />
                <span className={`flex-1 truncate ${medal ? medal.name : "text-chalk/90"}`}>{p.name}</span>
                <span className="scoreboard-digit text-slate text-xs">
                  {p.wins}–{p.losses}
                </span>
                <span className="scoreboard-digit text-amber font-semibold w-12 text-right">
                  {rankingValue(p, rankingMethod)}
                </span>
              </li>
            );
          })}
        </ol>
      )}
      {onViewAll && (playerStats || []).length > top.length && (
        <button
          onClick={onViewAll}
          className="mt-3 text-xs text-slate hover:text-amber transition-colors"
        >
          Full standings ({playerStats.length} players) →
        </button>
      )}
    </div>
  );
}
