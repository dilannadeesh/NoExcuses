import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { api } from "../api";

export default function GroupsPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);

  const load = () => {
    setLoading(true);
    api
      .listGroups()
      .then(setGroups)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!newName.trim()) return;
    setCreating(true);
    try {
      const group = await api.createGroup(newName.trim());
      setNewName("");
      setGroups((prev) => [{ ...group, owner_name: user?.name, member_count: 1, game_count: 0 }, ...prev]);
    } catch (e) {
      setError(e.message);
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 sm:py-10">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between mb-8 gap-4 sm:gap-6">
        <div>
          <div className="text-[11px] uppercase tracking-[0.2em] text-slate font-semibold mb-2">Your groups</div>
          <h1 className="font-display text-3xl sm:text-4xl md:text-5xl leading-none">
            Who's on <span className="text-amber">court</span> today?
          </h1>
        </div>
        <form onSubmit={handleCreate} className="flex gap-2">
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="New group name"
            className="bg-courtink-2 border border-white/10 rounded-sm px-3 py-2 text-sm placeholder:text-slate/70 focus:outline-none focus:border-amber flex-1 sm:w-48 sm:flex-none min-w-0"
          />
          <button
            type="submit"
            disabled={creating}
            className="bg-court hover:bg-court-light transition-colors rounded-sm px-4 py-2 text-sm font-semibold disabled:opacity-50 shrink-0"
          >
            + Create
          </button>
        </form>
      </div>

      {error && (
        <div className="mb-6 rounded-sm border border-fault/40 bg-fault/10 text-fault px-4 py-3 text-sm">{error}</div>
      )}

      {loading ? (
        <div className="text-slate">Loading groups…</div>
      ) : groups.length === 0 ? (
        <div className="border border-dashed border-white/15 rounded-sm px-6 py-14 text-center">
          <p className="text-slate mb-1">No groups yet.</p>
          <p className="text-sm text-slate/70">Create one above to start logging games with your regulars.</p>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 gap-4">
          {groups.map((g) => (
            <button
              key={g.id}
              onClick={() => navigate(`/groups/${g.id}`)}
              className="text-left bg-courtink-2 border border-white/5 hover:border-amber/50 rounded-sm px-5 py-5 transition-colors group"
            >
              <div className="flex items-start justify-between mb-4 gap-2">
                <div className="min-w-0">
                  <h2 className="font-display text-xl sm:text-2xl leading-tight group-hover:text-amber transition-colors truncate">
                    {g.name}
                  </h2>
                  {user && g.owner_name && g.owner_id !== user.id && (
                    <p className="text-xs text-slate mt-0.5 truncate">Owned by {g.owner_name}</p>
                  )}
                </div>
                <span className="text-slate text-lg shrink-0">→</span>
              </div>
              <div className="flex gap-6 court-line pt-3">
                <div>
                  <div className="scoreboard-digit text-xl text-chalk">{g.member_count}</div>
                  <div className="text-[10px] uppercase tracking-[0.15em] text-slate">Players</div>
                </div>
                <div>
                  <div className="scoreboard-digit text-xl text-chalk">{g.game_count}</div>
                  <div className="text-[10px] uppercase tracking-[0.15em] text-slate">Games logged</div>
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
