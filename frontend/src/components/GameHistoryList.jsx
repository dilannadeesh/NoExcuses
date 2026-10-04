import { Pencil, Trash2, Trophy } from "lucide-react";
import { api } from "../api";
import Avatar from "./Avatar";

function TeamRow({ players, won, scores, opponentScores }) {
  return (
    <div className="flex items-center gap-3">
      <span className="flex shrink-0 -space-x-2">
        {players.map((p) => (
          <Avatar key={p.id} name={p.name} size={players.length > 1 ? 28 : 34} className="ring-2 ring-white" />
        ))}
      </span>
      <span className={`min-w-0 flex-1 truncate text-[15px] ${won ? "font-bold" : "font-medium text-muted"}`}>
        {players.map((p) => p.name).join(" & ")}
      </span>
      {won && <Trophy size={15} className="shrink-0 text-gold" aria-label="Winner" />}
      <span className="flex shrink-0 gap-3">
        {scores.map((s, i) => (
          <span
            key={i}
            className={`num w-6 text-center text-[15px] ${s > opponentScores[i] ? "font-extrabold" : "text-muted"}`}
          >
            {s}
          </span>
        ))}
      </span>
    </div>
  );
}

const iconBtn =
  "grid h-9 w-9 place-items-center rounded-full bg-soft text-muted transition active:scale-95";

export default function GameHistoryList({ games, onChanged, canManage, onEdit }) {
  if (games.length === 0) {
    return (
      <div className="card px-6 py-10 text-center">
        <p className="font-semibold">No games yet</p>
        <p className="mt-1 text-sm text-muted">
          {canManage ? "Tap “Log a game” below to add the first one." : "Nothing has been logged in this group yet."}
        </p>
      </div>
    );
  }

  const handleDelete = async (id) => {
    if (!confirm("Delete this game? Rankings will update.")) return;
    await api.deleteGame(id);
    onChanged();
  };

  return (
    <ul className="space-y-3">
      {games.map((g) => {
        const s1 = g.sets.map((s) => s.side1_score);
        const s2 = g.sets.map((s) => s.side2_score);
        return (
          <li key={g.id} className="card p-4">
            <div className="flex items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="num text-xs font-medium text-muted">{String(g.played_at).slice(0, 10)}</span>
                <span className="chip capitalize">{g.match_type}</span>
                {g.went_to_deuce && <span className="chip bg-warn-soft text-warn">Deuce</span>}
              </div>
              {canManage && (
                <div className="flex shrink-0 gap-1.5">
                  <button onClick={() => onEdit(g)} aria-label="Edit game" className={`${iconBtn} hover:text-ink`}>
                    <Pencil size={15} />
                  </button>
                  <button
                    onClick={() => handleDelete(g.id)}
                    aria-label="Delete game"
                    className={`${iconBtn} hover:bg-loss-soft hover:text-loss`}
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              )}
            </div>
            <div className="mt-3 space-y-2">
              <TeamRow players={g.side1} won={g.winner_side === 1} scores={s1} opponentScores={s2} />
              <TeamRow players={g.side2} won={g.winner_side === 2} scores={s2} opponentScores={s1} />
            </div>
          </li>
        );
      })}
    </ul>
  );
}
