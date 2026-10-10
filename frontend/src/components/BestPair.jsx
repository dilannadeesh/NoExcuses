import { rankingValue } from "../lib/ranking";
import Avatar from "./Avatar";

// One-line highlight of the group's top doubles pair. The full pairs table
// lives in the Standings tab.
export default function BestPair({ pair, rankingMethod }) {
  if (!pair) return null;
  return (
    <section className="card flex items-center gap-3 px-4 py-3.5">
      <span className="flex shrink-0">
        {pair.names.map((n, i) => (
          <Avatar key={i} name={n} size={32} className={`ring-2 ring-surface ${i > 0 ? "-ml-2" : ""}`} />
        ))}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-xs text-muted">Best pair</p>
        <p className="truncate text-[15px] font-semibold">{pair.names.join(" & ")}</p>
      </div>
      <div className="text-right">
        <p className="num text-sm font-semibold">{rankingValue(pair, rankingMethod)}</p>
        <p className="num text-xs text-muted">
          {pair.wins}–{pair.losses}
        </p>
      </div>
    </section>
  );
}
