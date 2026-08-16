export default function StandingsView({ analytics }) {
  if (!analytics || analytics.totalGames === 0) {
    return <p className="text-slate text-sm py-6">Log a few games to see standings and analytics.</p>;
  }

  const { playerStats, pairStats } = analytics;

  return (
    <div className="grid md:grid-cols-2 gap-6 md:gap-8">
      <div>
        <div className="text-[11px] uppercase tracking-[0.15em] text-slate font-semibold mb-3">
          Player standings
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-slate text-xs uppercase tracking-wide court-line">
              <th className="py-2 font-medium">Player</th>
              <th className="py-2 font-medium text-right">W–L</th>
              <th className="py-2 font-medium text-right">Win %</th>
            </tr>
          </thead>
          <tbody>
            {playerStats.map((p, i) => (
              <tr key={p.id} className="border-b border-white/5">
                <td className="py-2 max-w-[160px] truncate">
                  {i === 0 && <span className="text-amber mr-1">★</span>}
                  {p.name}
                </td>
                <td className="py-2 text-right scoreboard-digit text-slate">
                  {p.wins}–{p.losses}
                </td>
                <td className="py-2 text-right scoreboard-digit font-semibold">{p.winPercentage}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div>
        <div className="text-[11px] uppercase tracking-[0.15em] text-slate font-semibold mb-3">
          Doubles pairs
        </div>
        {pairStats.length === 0 ? (
          <p className="text-slate text-sm">No doubles games logged yet.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-slate text-xs uppercase tracking-wide court-line">
                <th className="py-2 font-medium">Pair</th>
                <th className="py-2 font-medium text-right">W–L</th>
                <th className="py-2 font-medium text-right">Win %</th>
              </tr>
            </thead>
            <tbody>
              {pairStats.map((p, i) => (
                <tr key={p.key} className="border-b border-white/5">
                  <td className="py-2 max-w-[160px] truncate">
                    {i === 0 && <span className="text-amber mr-1">★</span>}
                    {p.names.join(" & ")}
                  </td>
                  <td className="py-2 text-right scoreboard-digit text-slate">
                    {p.wins}–{p.losses}
                  </td>
                  <td className="py-2 text-right scoreboard-digit font-semibold">{p.winPercentage}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
