import { rankingValue, rankingLabel } from "../lib/ranking";
import RankRow from "./RankRow";

// How many players the dashboard card lists; everyone else is behind
// the "Show all" button.
const TOP_N = 8;

export default function TopPlayersTile({ playerStats, rankingMethod, onViewAll }) {
  const all = playerStats || [];
  const top = all.slice(0, TOP_N);

  return (
    <section className="card p-4">
      <div className="mb-2 flex items-center justify-between px-1">
        <h2 className="section-title">Top players</h2>
        <span className="chip">{rankingLabel(rankingMethod)}</span>
      </div>
      {top.length === 0 ? (
        <p className="px-1 py-4 text-sm text-muted">No games logged yet.</p>
      ) : (
        <ol className="space-y-1">
          {top.map((p, i) => (
            <RankRow
              key={p.id}
              rank={i + 1}
              names={p.name}
              record={`${p.wins}–${p.losses}`}
              value={rankingValue(p, rankingMethod)}
            />
          ))}
        </ol>
      )}
      {onViewAll && all.length > top.length && (
        <button onClick={onViewAll} className="btn mt-3 h-11 w-full bg-soft text-sm text-ink hover:bg-line/70">
          Show all {all.length} players
        </button>
      )}
    </section>
  );
}
