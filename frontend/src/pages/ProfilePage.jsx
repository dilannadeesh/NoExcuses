import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ChevronRight, LogOut } from "lucide-react";
import { api } from "../api";
import { useAuth } from "../context/AuthContext";
import Avatar from "../components/Avatar";
import ScoreTile from "../components/ScoreTile";
import Screen from "../components/Screen";
import { LoadingBlock, ErrorNote } from "../components/States";

// Win % chip: green at or above 50, red below -- readable at a glance.
function PctChip({ pct }) {
  return (
    <span className={`num rounded-md px-2 py-0.5 text-sm font-semibold ${pct >= 50 ? "bg-win-soft text-win" : "bg-loss-soft text-loss"}`}>
      {pct}%
    </span>
  );
}

function PeopleCard({ title, empty, rows }) {
  return (
    <section className="mt-7">
      <h2 className="section-title mb-3 px-1">{title}</h2>
      {rows.length === 0 ? (
        <div className="card px-5 py-6 text-center text-sm text-muted">{empty}</div>
      ) : (
        <ul className="card divide-y divide-line px-2 py-1">
          {rows.map((r) => (
            <li key={r.id} className="flex items-center gap-3 px-2 py-3">
              <Avatar name={r.name} size={42} />
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold">{r.name}</p>
                <p className="num text-xs text-muted">
                  {r.wins}–{r.losses} · {r.games} games
                </p>
              </div>
              <PctChip pct={r.winPercentage} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export default function ProfilePage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .getMyStats()
      .then(setStats)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const handleLogout = async () => {
    await logout();
    navigate("/login", { replace: true });
  };

  return (
    <Screen bottom="nav">
      <section className="card flex items-center gap-4 p-5">
        <Avatar name={user?.name} size={56} />
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-2xl font-semibold leading-tight tracking-tight">{stats?.name || user?.name}</h1>
          <p className="truncate text-sm text-muted">{user?.email}</p>
          {user?.isAdmin && <span className="chip mt-2 bg-brand-soft text-brand">Super admin</span>}
        </div>
      </section>

      {loading ? (
        <LoadingBlock rows={3} className="mt-4" />
      ) : error || !stats ? (
        <ErrorNote className="mt-4">{error || "Couldn’t load your stats."}</ErrorNote>
      ) : (
        <>
          <div className="mt-4 grid grid-cols-3 gap-3">
            <ScoreTile label="Games" value={stats.totalGames} />
            <ScoreTile label="Record" value={`${stats.wins}–${stats.losses}`} />
            <ScoreTile label="Win rate" value={`${stats.winPercentage}%`} />
          </div>

          <section className="mt-7">
            <h2 className="section-title mb-3 px-1">By group</h2>
            {stats.groups.length === 0 ? (
              <div className="card px-5 py-6 text-center text-sm text-muted">Not in any groups yet.</div>
            ) : (
              <ul className="space-y-3">
                {stats.groups.map((g) => (
                  <li key={g.id}>
                    <Link to={`/groups/${g.id}`} className="card flex items-center gap-3 p-4 transition active:scale-[0.99]">
                      <Avatar name={g.name} size={44} shape="tile" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-semibold">{g.name}</p>
                        <p className="num text-xs text-muted">
                          {g.wins}–{g.losses}
                          {g.isOwner && " · you own this group"}
                        </p>
                      </div>
                      <PctChip pct={g.winPercentage} />
                      <ChevronRight size={18} className="shrink-0 text-faint" />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <PeopleCard title="Head-to-head" empty="No opponents faced yet." rows={stats.headToHead} />
          <PeopleCard title="Regular partners" empty="No doubles partners yet." rows={stats.partners} />
        </>
      )}

      <button onClick={handleLogout} className="btn-secondary mt-8 w-full">
        <LogOut size={18} /> Log out
      </button>
    </Screen>
  );
}
