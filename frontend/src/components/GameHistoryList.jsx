import { api } from "../api";

function SideNames({ players }) {
  return <span>{players.map((p) => p.name).join(" & ")}</span>;
}

export default function GameHistoryList({ games, onChanged, canManage }) {
  if (games.length === 0) {
    return <p className="text-slate text-sm py-6">No games logged yet. Log your first one above.</p>;
  }

  const handleDelete = async (id) => {
    await api.deleteGame(id);
    onChanged();
  };

  return (
    <div className="space-y-3">
      {games.map((g) => {
        const side1Won = g.winner_side === 1;
        return (
          <div key={g.id} className="bg-courtink-2 border border-white/5 rounded-sm px-5 py-4">
            <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
              <div className="flex items-center gap-2 text-xs">
                <span className="text-slate uppercase tracking-wide">{g.played_at}</span>
                <span className="text-slate/50">·</span>
                <span className="text-slate uppercase tracking-wide">{g.match_type}</span>
                {g.went_to_deuce && (
                  <span className="bg-amber/15 text-amber px-2 py-0.5 rounded-full font-semibold">Deuce</span>
                )}
              </div>
              {canManage && (
                <button onClick={() => handleDelete(g.id)} className="text-slate hover:text-fault text-xs">
                  delete
                </button>
              )}
            </div>
            <div className="flex items-center justify-between gap-4">
              <div className={`flex-1 text-sm ${side1Won ? "text-chalk font-semibold" : "text-slate"}`}>
                <SideNames players={g.side1} />
                {side1Won && <span className="text-amber ml-2">●</span>}
              </div>
              <div className="scoreboard-digit text-sm text-slate whitespace-nowrap">
                {g.sets.map((s) => `${s.side1_score}-${s.side2_score}`).join("  ")}
              </div>
              <div className={`flex-1 text-sm text-right ${!side1Won ? "text-chalk font-semibold" : "text-slate"}`}>
                {!side1Won && <span className="text-amber mr-2">●</span>}
                <SideNames players={g.side2} />
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
