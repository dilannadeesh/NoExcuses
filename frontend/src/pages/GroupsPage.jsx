import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ChevronRight, Plus, Trophy, Users } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { api } from "../api";
import Avatar from "../components/Avatar";
import Screen from "../components/Screen";
import { LoadingBlock, ErrorNote } from "../components/States";

export default function GroupsPage() {
  const { user } = useAuth();
  const [groups, setGroups] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    api
      .listGroups()
      .then(setGroups)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
    // The summary card is a nicety -- if it fails, the page still works.
    api.getMyStats().then(setStats).catch(() => {});
  }, []);

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!newName.trim()) return;
    setCreating(true);
    setError("");
    try {
      const group = await api.createGroup(newName.trim());
      setNewName("");
      setShowCreate(false);
      setGroups((prev) => [
        { ...group, owner_id: user?.id, owner_name: user?.name, member_count: 1, game_count: 0 },
        ...prev,
      ]);
    } catch (e) {
      setError(e.message);
    } finally {
      setCreating(false);
    }
  };

  const first = user?.name?.trim().split(/\s+/)[0] || "there";
  const hasGames = stats && stats.totalGames > 0;

  return (
    <Screen bottom="nav">
      <div className="px-1 pb-5 pt-1">
        <h1 className="text-2xl font-semibold leading-tight tracking-tight">Hi {first},</h1>
        <p className="mt-1 text-[15px] text-muted">Overview of your recent activity</p>
      </div>

      <section className="card flex items-center gap-4 p-4">
        <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-soft text-ink">
          <Trophy size={22} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium text-muted">Your record</p>
          {hasGames ? (
            <>
              <p className="num text-2xl font-semibold leading-tight tracking-tight">
                {stats.wins}–{stats.losses}
              </p>
              <p className="num text-xs text-muted">{stats.winPercentage}% win rate</p>
            </>
          ) : (
            <p className="mt-0.5 text-sm font-semibold leading-snug">No games yet</p>
          )}
        </div>
        <button
          onClick={() => setShowCreate((v) => !v)}
          aria-expanded={showCreate}
          className="btn h-10 shrink-0 bg-ink px-4 text-sm text-white"
        >
          New group <Plus size={16} strokeWidth={2.6} />
        </button>
      </section>

      {showCreate && (
        <form onSubmit={handleCreate} className="card mt-3 flex gap-2 p-3">
          <label htmlFor="new-group" className="sr-only">New group name</label>
          <input
            id="new-group"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Group name, e.g. Tuesday Crew"
            className="input min-w-0 flex-1"
            autoFocus
          />
          <button type="submit" disabled={creating} className="btn h-12 shrink-0 bg-ink px-5 text-sm text-white">
            {creating ? "Creating…" : "Create"}
          </button>
        </form>
      )}

      <ErrorNote className="mt-4">{error}</ErrorNote>

      <div className="mb-3 mt-7 flex items-baseline justify-between px-1">
        <h2 className="section-title">Your groups</h2>
        {groups.length > 0 && <span className="num text-sm font-medium text-muted">{groups.length}</span>}
      </div>

      {loading ? (
        <LoadingBlock rows={3} />
      ) : groups.length === 0 ? (
        <section className="card p-6">
          <p className="text-base font-semibold leading-snug tracking-tight">Start your first group</p>
          <p className="mt-1.5 text-sm leading-relaxed text-muted">
            Create a group for your regulars, then log games to see rankings build up.
          </p>
          <button onClick={() => setShowCreate(true)} className="btn mt-4 h-11 bg-ink px-5 text-sm text-white">
            Create a group <Plus size={16} strokeWidth={2.6} />
          </button>
        </section>
      ) : (
        <ul className="space-y-3">
          {groups.map((g) => {
            const owned = user && g.owner_id === user.id;
            return (
              <li key={g.id}>
                <Link to={`/groups/${g.id}`} className="card flex items-center gap-4 p-4 transition active:scale-[0.99]">
                  <Avatar name={g.name} size={48} shape="tile" />
                  <div className="min-w-0 flex-1">
                    <h3 className="line-clamp-2 break-words text-base font-semibold leading-snug tracking-tight">{g.name}</h3>
                    <p className="mt-0.5 truncate text-xs text-muted">
                      {owned ? "You own this group" : `Owned by ${g.owner_name}`}
                    </p>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {owned && <span className="chip bg-brand-soft text-brand">Owner</span>}
                      <span className="chip">
                        <Users size={12} /> {g.member_count}
                      </span>
                      <span className="chip">{g.game_count} games</span>
                    </div>
                  </div>
                  <ChevronRight size={18} className="shrink-0 text-faint" />
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </Screen>
  );
}
