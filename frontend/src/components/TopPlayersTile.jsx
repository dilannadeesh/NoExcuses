export default function TopPlayersTile({ playerStats }) {
  const top5 = (playerStats || []).slice(0, 5);

  return (
    <div className="relative flex-1 min-w-[280px] rounded-sm bg-courtink-2 border border-white/5 px-5 py-4 overflow-hidden">
      <div className="absolute top-0 left-0 h-[3px] w-full bg-amber" />
      <div className="text-[11px] uppercase tracking-[0.18em] text-slate font-semibold mb-2">
        Top players
      </div>
      {top5.length === 0 ? (
        <p className="text-sm text-slate py-1">No games logged yet.</p>
      ) : (
        <ol className="space-y-1.5">
          {top5.map((p, i) => (
            <li key={p.id} className="flex items-center gap-2 text-sm">
              <span className="scoreboard-digit text-slate w-4 text-right">{i + 1}</span>
              <span className={`flex-1 truncate ${i === 0 ? "text-chalk font-semibold" : "text-chalk/90"}`}>
                {p.name}
              </span>
              <span className="scoreboard-digit text-slate text-xs">
                {p.wins}–{p.losses}
              </span>
              <span className="scoreboard-digit text-amber font-semibold w-12 text-right">
                {p.winPercentage}%
              </span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
