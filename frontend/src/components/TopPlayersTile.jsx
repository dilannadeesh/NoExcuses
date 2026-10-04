import { Trophy } from "lucide-react";
import { rankingValue, rankingLabel } from "../lib/ranking";
import Avatar from "./Avatar";

// The dashboard card lists this many players (podium + the rows under it);
// everyone else is behind the "Show all" button.
const TOP_N = 8;

// 1st stands tallest in the middle. DOM order is rank order (so screen readers
// read 1, 2, 3); `order` places them 2nd | 1st | 3rd on screen.
const PODIUM = [
  {
    rank: 1,
    order: "order-2",
    avatar: 60,
    ring: "shadow-[0_0_0_2px_#fff,0_0_0_4px_#D99A1E]",
    step: "h-20 bg-gold-soft text-[22px] text-[#8A5A12]",
    name: "text-[15px]",
  },
  {
    rank: 2,
    order: "order-1",
    avatar: 48,
    ring: "shadow-[0_0_0_2px_#fff,0_0_0_4px_#94A3B8]",
    step: "h-[52px] bg-silver-soft text-xl text-[#475569]",
    name: "text-sm",
  },
  {
    rank: 3,
    order: "order-3",
    avatar: 48,
    ring: "shadow-[0_0_0_2px_#fff,0_0_0_4px_#B9773F]",
    step: "h-9 bg-bronze-soft text-xl text-[#7A4A1E]",
    name: "text-sm",
  },
];

function PodiumSlot({ spec, player, rankingMethod }) {
  // Fewer than three players: keep the slot so 1st stays centred.
  if (!player) return <li aria-hidden="true" className={spec.order} />;
  return (
    <li className={`flex min-w-0 flex-col items-center gap-1 ${spec.order}`}>
      {spec.rank === 1 && <Trophy size={18} className="text-gold" aria-label="Leader" />}
      <Avatar name={player.name} size={spec.avatar} className={spec.ring} />
      <span className={`mt-1.5 max-w-full truncate font-semibold ${spec.name}`}>{player.name}</span>
      <span className="num rounded-lg bg-soft px-2 py-0.5 text-[13px] font-semibold">
        {rankingValue(player, rankingMethod)}
      </span>
      <span className="num text-xs text-muted">
        {player.wins}–{player.losses}
      </span>
      <span
        aria-label={`Rank ${spec.rank}`}
        className={`num mt-1.5 grid w-full place-items-center rounded-t-xl font-bold ${spec.step}`}
      >
        {spec.rank}
      </span>
    </li>
  );
}

export default function TopPlayersTile({ playerStats, rankingMethod, onViewAll }) {
  const all = playerStats || [];
  const rest = all.slice(3, TOP_N);

  return (
    <section className="card p-4">
      <div className="mb-5 flex items-center justify-between">
        <h2 className="section-title">Top players</h2>
        <span className="chip">{rankingLabel(rankingMethod)}</span>
      </div>

      {all.length === 0 ? (
        <p className="py-4 text-sm text-muted">No games logged yet.</p>
      ) : (
        <>
          <ol className="grid grid-cols-3 items-end gap-2 text-center">
            {PODIUM.map((spec) => (
              <PodiumSlot key={spec.rank} spec={spec} player={all[spec.rank - 1]} rankingMethod={rankingMethod} />
            ))}
          </ol>

          {rest.length > 0 && (
            <ol start={4} className="mt-3">
              {rest.map((p, i) => (
                <li key={p.id} className="flex items-center gap-3 border-t border-soft px-1 py-2.5">
                  <span className="num w-6 text-center text-sm font-semibold text-muted">{i + 4}</span>
                  <Avatar name={p.name} size={32} />
                  <span className="min-w-0 flex-1 truncate text-[15px] font-medium">{p.name}</span>
                  <span className="num text-xs text-muted">
                    {p.wins}–{p.losses}
                  </span>
                  <span className="num min-w-[52px] text-right text-sm font-semibold">
                    {rankingValue(p, rankingMethod)}
                  </span>
                </li>
              ))}
            </ol>
          )}

          {onViewAll && all.length > TOP_N && (
            <button onClick={onViewAll} className="btn mt-2 h-11 w-full bg-soft text-sm text-ink hover:bg-line/70">
              Show all {all.length} players
            </button>
          )}
        </>
      )}
    </section>
  );
}
