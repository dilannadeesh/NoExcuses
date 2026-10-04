import { useEffect, useState } from "react";

// A scripted rally, not a literal point-by-point simulation -- fast enough
// to watch once without getting impatient, but real enough to pass through
// an actual deuce (both sides at 20+), which is the one moment that shows
// off something the app specifically does (automatic deuce detection).
const SEQUENCE = [
  [0, 0],
  [3, 1],
  [5, 4],
  [8, 6],
  [11, 9],
  [13, 12],
  [16, 14],
  [18, 17],
  [20, 18],
  [20, 20], // deuce
  [21, 20],
  [22, 20], // won by 2, clear
];

const STEP_MS = 550;

export default function LiveScoreboardDemo() {
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (step >= SEQUENCE.length - 1) return;
    const t = setTimeout(() => setStep((s) => s + 1), STEP_MS);
    return () => clearTimeout(t);
  }, [step]);

  const [left, right] = SEQUENCE[step];
  const isFinal = step === SEQUENCE.length - 1;
  const isDeuce = left >= 20 && right >= 20 && !isFinal;

  return (
    <div className="card p-5">
      <div className="flex items-center justify-between">
        {isFinal ? (
          <span className="chip bg-win-soft text-win">Match complete</span>
        ) : (
          <span className="chip bg-loss-soft text-loss">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-loss" />
            LIVE
          </span>
        )}
        <span className={`chip ${isDeuce ? "bg-warn-soft text-warn" : ""}`}>{isDeuce ? "Deuce" : "Set 3"}</span>
      </div>

      <div className="mt-4 grid grid-cols-[1fr_auto_1fr] items-center gap-3">
        <div className={`min-w-0 text-sm ${isFinal && left > right ? "font-semibold text-ink" : "font-semibold text-muted"}`}>
          Maya &amp; Leo
        </div>
        <div className="num text-3xl font-semibold leading-none tracking-tight">
          {left}–{right}
        </div>
        <div
          className={`min-w-0 text-right text-sm ${
            isFinal && right > left ? "font-semibold text-ink" : "font-semibold text-muted"
          }`}
        >
          Noor &amp; Sam
        </div>
      </div>

      {isFinal && (
        <p className="mt-4 flex items-center gap-2 border-t border-line pt-3 text-xs text-muted">
          <span className="h-1.5 w-1.5 rounded-full bg-win" />
          Maya &amp; Leo win — logged in 4 seconds
        </p>
      )}
    </div>
  );
}
