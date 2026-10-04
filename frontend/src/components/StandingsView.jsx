import { rankingValue, rankingLabel } from "../lib/ranking";
import RankRow from "./RankRow";

export default function StandingsView({ analytics }) {
  if (!analytics || analytics.totalGames === 0) {
    return (
      <div className="card px-6 py-10 text-center">
        <p className="font-semibold">Nothing to rank yet</p>
        <p className="mt-1 text-sm text-muted">Log a few games to see standings and analytics.</p>
      </div>
    );
  }

  const { playerStats, pairStats, rankingMethod } = analytics;
  const label = rankingLabel(rankingMethod);

  return (
    <div className="space-y-4">
      <section className="card p-4">
        <div className="mb-2 flex items-center justify-between px-1">
          <h2 className="section-title">Player standings</h2>
          <span className="chip">{label}</span>
        </div>
        <ol className="space-y-1">
          {playerStats.map((p, i) => (
            <RankRow
              key={p.id}
              rank={i + 1}
              names={p.name}
              record={`${p.wins}–${p.losses}`}
              value={rankingValue(p, rankingMethod)}
            />
          ))}
        </ol>
      </section>

      <section className="card p-4">
        <div className="mb-2 flex items-center justify-between px-1">
          <h2 className="section-title">Doubles pairs</h2>
          <span className="chip">{label}</span>
        </div>
        {pairStats.length === 0 ? (
          <p className="px-1 py-4 text-sm text-muted">No doubles games logged yet.</p>
        ) : (
          <ol className="space-y-1">
            {pairStats.map((p, i) => (
              <RankRow
                key={p.key}
                rank={i + 1}
                names={p.names}
                record={`${p.wins}–${p.losses}`}
                value={rankingValue(p, rankingMethod)}
              />
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}
