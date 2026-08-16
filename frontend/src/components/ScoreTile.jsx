export default function ScoreTile({ label, value, sub, accent = "amber" }) {
  const accentClass = accent === "amber" ? "text-amber" : accent === "fault" ? "text-fault" : "text-court-light";
  const barClass = accent === "amber" ? "bg-amber" : accent === "fault" ? "bg-fault" : "bg-court-light";

  return (
    <div className="relative w-full sm:flex-1 sm:min-w-[140px] rounded-sm bg-courtink-2 border border-white/5 px-5 py-4 overflow-hidden">
      <div className={`absolute top-0 left-0 h-[3px] w-full ${barClass}`} />
      <div className="text-[11px] uppercase tracking-[0.18em] text-slate font-semibold mb-1">{label}</div>
      <div className={`scoreboard-digit text-4xl font-semibold ${accentClass}`}>{value}</div>
      {sub && <div className="text-xs text-slate mt-1">{sub}</div>}
    </div>
  );
}
