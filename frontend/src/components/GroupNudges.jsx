import { Link } from "react-router-dom";
import { CalendarClock, Check, Coins, UserPlus, X } from "lucide-react";

const highlight = {
  borderColor: "#3c5220",
  background: "linear-gradient(160deg, #1a2c10 0%, #0b120e 80%)",
};

function CloseButton({ onClick, label = "Dismiss" }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="absolute right-1.5 top-1.5 grid h-11 w-11 place-items-center rounded-xl text-muted hover:text-ink"
    >
      <X size={18} />
    </button>
  );
}

const STEP_ACTION = {
  players: { label: "Add players", Icon: UserPlus, to: (g) => `/groups/${g}/members` },
  game: { label: "Log a game", Icon: null, to: (g) => `/groups/${g}/log` },
  cost: { label: "Add a cost", Icon: Coins, to: (g) => `/groups/${g}/owe/add` },
};

// Owner/admin, brand-new group: the whole path, with the current step's button.
export function SetupChecklist({ groupId, groupName, progress, onDismiss }) {
  const pct = Math.round((progress.doneCount / progress.total) * 100);
  return (
    <section aria-label="Set up your group" className="card relative px-4 pb-1.5 pt-4">
      <CloseButton onClick={onDismiss} label="Hide setup steps" />
      <div className="flex items-baseline justify-between gap-3 pr-10">
        <h2 className="min-w-0 truncate text-base font-bold">Get {groupName} going</h2>
        <span className="num shrink-0 text-[13px] text-muted">
          {progress.doneCount} of {progress.total} done
        </span>
      </div>
      <div
        className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-soft"
        role="progressbar"
        aria-valuenow={progress.doneCount}
        aria-valuemin={0}
        aria-valuemax={progress.total}
        aria-label="Setup progress"
      >
        <div className="h-full rounded-full bg-lime transition-all" style={{ width: `${pct}%` }} />
      </div>
      <ol className="mt-2">
        {progress.steps.map((s, i) => {
          const current = s.id === progress.current;
          const action = STEP_ACTION[s.id];
          return (
            <li key={s.id} className={`flex gap-3 py-3 ${i < progress.steps.length - 1 ? "border-b border-line" : ""}`}>
              {s.done ? (
                <span className="grid h-[26px] w-[26px] shrink-0 place-items-center rounded-full bg-lime text-onlime">
                  <Check size={14} strokeWidth={3.2} aria-hidden />
                </span>
              ) : (
                <span
                  className={`num grid h-[26px] w-[26px] shrink-0 place-items-center rounded-full border-2 text-xs font-bold ${
                    current ? "border-lime text-lime" : "border-line text-muted"
                  }`}
                >
                  {i + 1}
                </span>
              )}
              <div className="min-w-0 flex-1">
                <p className={`text-[15px] ${s.done ? "text-muted line-through" : "font-semibold"}`}>
                  {s.title}
                  {s.done && <span className="sr-only"> (done)</span>}
                </p>
                {!s.done && s.body && <p className="mt-0.5 text-[13px] leading-relaxed text-muted">{s.body}</p>}
                {current && action && (
                  <Link
                    to={action.to(groupId)}
                    className="btn mt-2.5 h-10 bg-lime px-3.5 text-sm font-bold text-onlime"
                  >
                    {action.Icon && <action.Icon size={16} strokeWidth={2.4} aria-hidden />}
                    {action.label}
                  </Link>
                )}
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

const NEXT = {
  "next:cost": {
    Icon: Coins,
    title: "Add the court fee",
    body: "Paid for the court or shuttles? Add it and split it with whoever played. Everyone sees their share.",
    action: "Add a cost",
    to: (g) => `/groups/${g}/owe/add`,
  },
  "next:plan": {
    Icon: CalendarClock,
    title: "Plan tonight's games",
    body: "Tick who turned up and get balanced matches for every court. Share it to WhatsApp in one tap.",
    action: "Plan tonight",
    to: (g) => `/groups/${g}/schedule`,
  },
};

// After the basics: one suggestion at a time.
export function NextStepCard({ kind, groupId, doneCount, total, onDismiss }) {
  const n = NEXT[kind];
  if (!n) return null;
  return (
    <section aria-label="Next step" className="relative rounded-2xl border p-4 shadow-card" style={highlight}>
      <CloseButton onClick={onDismiss} />
      <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-lime">
        Next step <span className="font-medium normal-case tracking-normal text-muted">· {doneCount} of {total} done</span>
      </p>
      <div className="mt-2.5 flex gap-3 pr-7">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-lime text-onlime">
          <n.Icon size={20} aria-hidden />
        </span>
        <div>
          <p className="text-base font-bold">{n.title}</p>
          <p className="mt-0.5 text-[13px] leading-relaxed text-muted">{n.body}</p>
        </div>
      </div>
      <div className="mt-3.5 flex gap-2">
        <Link to={n.to(groupId)} className="btn h-11 bg-lime px-4 text-sm font-bold text-onlime">
          {n.action}
        </Link>
        <button type="button" onClick={onDismiss} className="btn h-11 border border-line px-4 text-sm text-ink hover:bg-soft">
          Not now
        </button>
      </div>
    </section>
  );
}

// A player's first visit to a group someone else runs.
export function MemberWelcome({ firstName, ownerName, groupName, onDismiss }) {
  const items = [
    ["Log the games you play", ", set by set"],
    ["See where you rank", " and who you beat most"],
    ["Check what you owe", " for courts and shuttles, and settle up"],
  ];
  return (
    <section aria-label="Welcome" className="rounded-2xl border p-[18px] shadow-card" style={highlight}>
      <h2 className="display text-[26px]">Welcome, {firstName}</h2>
      <p className="mt-1 text-[13px] text-muted">
        {ownerName} added you to {groupName}. You can:
      </p>
      <ul className="mt-3.5 space-y-2.5">
        {items.map(([b, rest]) => (
          <li key={b} className="flex gap-2.5 text-sm leading-snug">
            <Check size={18} strokeWidth={2.6} className="shrink-0 text-lime" aria-hidden />
            <span>
              <b className="font-semibold">{b}</b>
              {rest}
            </span>
          </li>
        ))}
      </ul>
      <button type="button" onClick={onDismiss} className="btn mt-4 h-11 bg-lime px-[18px] text-sm font-bold text-onlime">
        Got it
      </button>
    </section>
  );
}

// One-time pointer at the Owe button. Rendered inside a `relative` wrapper.
export function OweTip({ onDismiss }) {
  return (
    <div
      id="owe-tip"
      role="tooltip"
      className="absolute right-0 top-14 z-30 w-[264px] rounded-[14px] bg-lime p-3.5 pb-3 text-onlime shadow-[0_16px_40px_-12px_rgba(0,0,0,.8)]"
    >
      <span aria-hidden="true" className="absolute -top-1.5 right-[30px] h-3 w-3 rotate-45 bg-lime" />
      <p className="text-[11px] font-extrabold uppercase tracking-[0.14em]">New · Split costs</p>
      <p className="mt-1.5 text-sm font-bold leading-snug">Paid for the court or shuttles?</p>
      <p className="mt-1 text-[13px] leading-relaxed">
        Tap Owe to add the cost and split it with whoever played. Everyone sees their share, and you can settle up in one
        tap.
      </p>
      <div className="mt-2.5 flex justify-end">
        <button
          type="button"
          onClick={onDismiss}
          className="h-9 rounded-[10px] bg-onlime px-3.5 text-[13px] font-bold text-lime"
        >
          Got it
        </button>
      </div>
    </div>
  );
}
