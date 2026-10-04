import Avatar from "./Avatar";
import RankBadge, { medalFor } from "./RankBadge";

// One ranked line: players and pairs share it, so every ranking list in the
// app looks and behaves the same. `names` is a string, or an array for pairs.
export default function RankRow({ rank, names, record, value }) {
  const medal = medalFor(rank);
  const list = Array.isArray(names) ? names : [names];
  const avatarSize = list.length > 1 ? 28 : 36;
  return (
    <li className={`flex items-center gap-3 rounded-xl px-3 py-2.5 ${medal ? medal.row : ""}`}>
      <RankBadge rank={rank} />
      <span className="flex shrink-0 -space-x-2">
        {list.map((n, i) => (
          <Avatar key={i} name={n} size={avatarSize} className="ring-2 ring-white" />
        ))}
      </span>
      <span className="min-w-0 flex-1">
        <span className={`block truncate text-[15px] leading-tight ${medal ? "font-semibold" : "font-medium"}`}>
          {list.join(" & ")}
        </span>
        {record && <span className="num block text-xs text-muted">{record}</span>}
      </span>
      <span className={`num shrink-0 rounded-lg px-2.5 py-1 text-sm font-semibold ${medal ? "bg-white/80" : "bg-soft"}`}>
        {value}
      </span>
    </li>
  );
}
