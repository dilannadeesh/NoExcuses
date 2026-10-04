import { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { api } from "../api";
import LogGameForm from "../components/LogGameForm";

// Serves two routes: /groups/:id/log (new game) and
// /groups/:id/log/:gameId (edit an existing one, pre-filled). Either way,
// saving sends you back to the group home so the result is right there.
export default function LogGamePage() {
  const { groupId, gameId } = useParams();
  const navigate = useNavigate();
  const [group, setGroup] = useState(null);
  const [members, setMembers] = useState([]);
  const [editingGame, setEditingGame] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    Promise.all([
      api.getGroup(groupId),
      api.listMembers(groupId),
      gameId ? api.getGame(gameId) : Promise.resolve(null),
    ])
      .then(([g, m, game]) => {
        if (cancelled) return;
        if (game && String(game.group_id) !== String(groupId)) {
          throw new Error("That game doesn't belong to this group.");
        }
        setGroup(g);
        setMembers(m);
        setEditingGame(game);
      })
      .catch((e) => !cancelled && setError(e.message))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [groupId, gameId]);

  const goHome = () => navigate(`/groups/${groupId}`);

  if (loading) return <div className="max-w-3xl mx-auto px-4 sm:px-6 py-10 text-slate">Loading…</div>;
  if (error || !group) {
    return (
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-10">
        <p className="text-fault text-sm">{error || "Group not found."}</p>
        <Link to={`/groups/${groupId}`} className="inline-block mt-4 text-sm text-slate hover:text-amber">
          ← Back to group
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8 sm:py-10">
      <Link to={`/groups/${groupId}`} className="inline-block text-sm text-slate hover:text-amber mb-6">
        ← Back to {group.name}
      </Link>

      <div className="text-[11px] uppercase tracking-[0.2em] text-slate font-semibold mb-2">{group.name}</div>
      <h1 className="font-display text-3xl sm:text-4xl leading-none mb-8">
        {editingGame ? "Edit game" : "Log a game"}
      </h1>

      <LogGameForm
        key={gameId || "new"}
        groupId={groupId}
        members={members}
        editingGame={editingGame}
        onCancelEdit={goHome}
        onSaved={goHome}
      />
    </div>
  );
}
