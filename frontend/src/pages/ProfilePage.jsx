import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api";
import ScoreTile from "../components/ScoreTile";

export default function ProfilePage() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getMyStats().then((s) => {
      setStats(s);
      setLoading(false);
    });
  }, []);

  if (loading || !stats) {
    return <div className="max-w-3xl mx-auto px-4 sm:px-6 py-10 text-slate">Loading…</div>;
  }

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8 sm:py-10">
      <div className="text-[11px] uppercase tracking-[0.2em] text-slate font-semibold mb-2">Your stats</div>
      <h1 className="font-display text-3xl sm:text-4xl md:text-5xl leading-none mb-8">{stats.name}</h1>

      <div className="flex flex-wrap gap-3 mb-10">
        <ScoreTile label="Games played" value={stats.totalGames} accent="court" />
        <ScoreTile label="Record" value={`${stats.wins}–${stats.losses}`} accent="amber" />
        <ScoreTile label="Win %" value={`${stats.winPercentage}%`} accent="amber" />
      </div>

      <section className="mb-10">
        <h2 className="text-[11px] uppercase tracking-[0.15em] text-slate font-semibold mb-3">By group</h2>
        {stats.groups.length === 0 ? (
          <p className="text-slate text-sm">Not in any groups yet.</p>
        ) : (
          <div className="space-y-2">
            {stats.groups.map((g) => (
              <Link
                key={g.id}
                to={`/groups/${g.id}`}
                className="flex items-center justify-between gap-3 bg-courtink-2 border border-white/5 hover:border-amber/50 rounded-sm px-4 py-3 transition-colors"
              >
                <span className="truncate">
                  {g.name}
                  {g.isOwner && (
                    <span className="ml-2 text-[10px] uppercase tracking-wide text-slate">owner</span>
                  )}
                </span>
                <span className="scoreboard-digit text-sm text-slate shrink-0">
                  {g.wins}–{g.losses} · {g.winPercentage}%
                </span>
              </Link>
            ))}
          </div>
        )}
      </section>

      <section className="mb-10">
        <h2 className="text-[11px] uppercase tracking-[0.15em] text-slate font-semibold mb-3">
          Head-to-head
        </h2>
        {stats.headToHead.length === 0 ? (
          <p className="text-slate text-sm">No opponents faced yet.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-slate text-xs uppercase tracking-wide court-line">
                <th className="py-2 font-medium">Opponent</th>
                <th className="py-2 font-medium text-right">W–L</th>
                <th className="py-2 font-medium text-right">Win %</th>
              </tr>
            </thead>
            <tbody>
              {stats.headToHead.map((h) => (
                <tr key={h.id} className="border-b border-white/5">
                  <td className="py-2 max-w-[200px] truncate">{h.name}</td>
                  <td className="py-2 text-right scoreboard-digit text-slate">
                    {h.wins}–{h.losses}
                  </td>
                  <td className="py-2 text-right scoreboard-digit font-semibold">{h.winPercentage}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section>
        <h2 className="text-[11px] uppercase tracking-[0.15em] text-slate font-semibold mb-3">
          Regular partners
        </h2>
        {stats.partners.length === 0 ? (
          <p className="text-slate text-sm">No doubles partners yet.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-slate text-xs uppercase tracking-wide court-line">
                <th className="py-2 font-medium">Partner</th>
                <th className="py-2 font-medium text-right">W–L</th>
                <th className="py-2 font-medium text-right">Win %</th>
              </tr>
            </thead>
            <tbody>
              {stats.partners.map((p) => (
                <tr key={p.id} className="border-b border-white/5">
                  <td className="py-2 max-w-[200px] truncate">{p.name}</td>
                  <td className="py-2 text-right scoreboard-digit text-slate">
                    {p.wins}–{p.losses}
                  </td>
                  <td className="py-2 text-right scoreboard-digit font-semibold">{p.winPercentage}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
