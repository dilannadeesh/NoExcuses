import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { api } from "../api";
import LogGameForm from "../components/LogGameForm";
import Screen from "../components/Screen";
import { LoadingBlock, ErrorNote } from "../components/States";

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

  if (loading) return <Screen><LoadingBlock rows={3} /></Screen>;
  if (error || !group) {
    return (
      <Screen>
        <ErrorNote>{error || "Group not found."}</ErrorNote>
      </Screen>
    );
  }

  return (
    <Screen bottom="cta">
      <h1 className="px-1 text-2xl font-semibold leading-tight tracking-tight">
        {editingGame ? "Edit game" : "New game"}
      </h1>
      <p className="mb-5 mt-1 px-1 text-sm text-muted">{group.name}</p>

      <LogGameForm
        key={gameId || "new"}
        groupId={groupId}
        members={members}
        editingGame={editingGame}
        onCancelEdit={goHome}
        onSaved={goHome}
      />
    </Screen>
  );
}
