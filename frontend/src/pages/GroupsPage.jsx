import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { CalendarClock, ChevronRight, Coins, Plus, Trophy, Users } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { api } from "../api";
import Avatar from "../components/Avatar";
import Screen from "../components/Screen";
import { LoadingBlock, ErrorNote } from "../components/States";

const BENEFITS = [
  { Icon: Trophy, title: "Settle who's best", body: "Log games set by set and watch the rankings build." },
  { Icon: CalendarClock, title: "Fair games every night", body: "Balanced matches for every court. Nobody sits out twice." },
  { Icon: Coins, title: "Split the court fee", body: "Everyone sees what they owe. No chasing people." },
];

function CreateGroupForm({ value, onChange, onSubmit, creating, className = "" }) {
  return (
    <form onSubmit={onSubmit} className={`flex gap-2 ${className}`}>
      <label htmlFor="new-group" className="sr-only">New group name</label>
      <input
        id="new-group"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Group name, e.g. Tuesday Crew"
        className="input min-w-0 flex-1"
        autoFocus
      />
      <button type="submit" disabled={creating || !value.trim()} className="btn h-12 shrink-0 bg-lime px-5 text-sm text-onlime">
        {creating ? "Creating…" : "Create"}
      </button>
    </form>
  );
}

// First run: no groups yet. Say what the app is for, one clear action, and
// a pointer for people whose organiser hasn't added them yet.
function NewUserWelcome({ email, showCreate, setShowCreate, form }) {
  return (
    <>
      <section
        className="rounded-2xl border border-line p-5 shadow-card"
        style={{ background: "linear-gradient(160deg, #13281a 0%, #0b120e 75%)" }}
      >
        <h2 className="display text-[30px]">
          Scores, fair games and the court fee. <span className="text-lime">Sorted.</span>
        </h2>
        <ul className="mt-4 space-y-3">
          {BENEFITS.map(({ Icon, title, body }) => (
            <li key={title} className="flex items-start gap-3">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-lime-soft text-lime">
                <Icon size={19} aria-hidden />
              </span>
              <span>
                <span className="block text-[15px] font-semibold">{title}</span>
                <span className="mt-0.5 block text-[13px] leading-relaxed text-muted">{body}</span>
              </span>
            </li>
          ))}
        </ul>
        {showCreate ? (
          form
        ) : (
          <>
            <button onClick={() => setShowCreate(true)} className="btn-primary mt-5 w-full">
              Create your group <Plus size={18} strokeWidth={2.6} />
            </button>
            <p className="mt-2 text-center text-xs text-muted">Takes a minute. Your friends don’t need the app yet.</p>
          </>
        )}
      </section>

      <section className="card mt-3 flex items-start gap-3 p-4">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-soft text-ink">
          <Users size={19} aria-hidden />
        </span>
        <div className="min-w-0">
          <p className="text-[15px] font-semibold">Joining a friend’s group?</p>
          <p className="mt-0.5 text-[13px] leading-relaxed text-muted">
            Ask the organiser to add this email, and their group shows up here on its own:
          </p>
          <p className="mt-1 truncate text-[13px] font-semibold text-ink" title={email}>
            {email}
          </p>
        </div>
      </section>
    </>
  );
}

export default function GroupsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
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
      // Straight into the new group, where the setup checklist takes over.
      navigate(`/groups/${group.id}`);
    } catch (e) {
      setError(e.message);
    } finally {
      setCreating(false);
    }
  };

  const first = user?.name?.trim().split(/\s+/)[0] || "there";
  const hasGames = stats && stats.totalGames > 0;

  const createForm = (
    <CreateGroupForm value={newName} onChange={setNewName} onSubmit={handleCreate} creating={creating} className="mt-5" />
  );

  if (!loading && groups.length === 0 && !error) {
    return (
      <Screen bottom="nav">
        <div className="px-1 pb-5 pt-1">
          <h1 className="display text-[32px]">Hi {first},</h1>
          <p className="mt-1 text-[15px] text-muted">Here’s what NoExcuses does for your group.</p>
        </div>
        <NewUserWelcome email={user?.email} showCreate={showCreate} setShowCreate={setShowCreate} form={createForm} />
      </Screen>
    );
  }

  return (
    <Screen bottom="nav">
      <div className="px-1 pb-5 pt-1">
        <h1 className="display text-[32px]">Hi {first},</h1>
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
              <p className="num display text-[32px]">
                {stats.wins}–{stats.losses}
              </p>
              <p className="num text-xs text-muted">{stats.winPercentage}% win rate</p>
            </>
          ) : (
            <p className="mt-0.5 text-sm font-semibold leading-snug">Starts after your first game</p>
          )}
        </div>
        <button
          onClick={() => setShowCreate((v) => !v)}
          aria-expanded={showCreate}
          className="btn h-10 shrink-0 bg-lime px-4 text-sm text-onlime"
        >
          New group <Plus size={16} strokeWidth={2.6} />
        </button>
      </section>

      {showCreate && (
        <div className="card mt-3 p-3">
          <CreateGroupForm value={newName} onChange={setNewName} onSubmit={handleCreate} creating={creating} />
        </div>
      )}

      <ErrorNote className="mt-4">{error}</ErrorNote>

      <div className="mb-3 mt-7 flex items-baseline justify-between px-1">
        <h2 className="section-title">Your groups</h2>
        {groups.length > 0 && <span className="num text-sm font-medium text-muted">{groups.length}</span>}
      </div>

      {loading ? (
        <LoadingBlock rows={3} />
      ) : groups.length === 0 ? null : (
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
