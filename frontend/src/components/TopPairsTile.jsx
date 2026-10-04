import { rankingValue, rankingLabel } from "../lib/ranking";
import RankRow from "./RankRow";

export default function TopPairsTile({ pairStats, rankingMethod }) {
  const top3 = (pairStats || []).slice(0, 3);

  return (
    <section className="card p-4">
      <div className="mb-2 flex items-center justify-between px-1">
        <h2 className="section-title">Best pairs</h2>
        <span className="chip">{rankingLabel(rankingMethod)}</span>
      </div>
      {top3.length === 0 ? (
        <p className="px-1 py-4 text-sm text-muted">No doubles games yet.</p>
      ) : (
        <ol className="space-y-1">
          {top3.map((p, i) => (
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
  );
}
