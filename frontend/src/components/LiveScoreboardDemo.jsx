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
  const isDeuce = left >= 20 && right >= 20 && step < SEQUENCE.length - 1;
  const isFinal = step === SEQUENCE.length - 1;

  return (
    <div className="relative w-full max-w-md bg-courtink-2 border border-white/10 rounded-sm px-6 py-5 sm:px-8 sm:py-6">
      <div className="absolute top-0 left-0 h-[3px] w-full bg-amber" />
      <div className="flex items-center justify-between text-xs uppercase tracking-[0.15em] text-slate mb-4">
        <span>{isFinal ? "Match complete" : "Live"}</span>
        <span className={isDeuce ? "text-amber font-semibold" : ""}>{isDeuce ? "Deuce" : "Set 3"}</span>
      </div>
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0">
          <div className={`text-sm sm:text-base truncate ${isFinal && left > right ? "text-chalk font-semibold" : "text-slate"}`}>
            Maya &amp; Leo
          </div>
        </div>
        <div className="scoreboard-digit text-4xl sm:text-5xl font-semibold text-chalk shrink-0 tabular-nums">
          {left}&ndash;{right}
        </div>
        <div className="min-w-0 text-right">
          <div className={`text-sm sm:text-base truncate ${isFinal && right > left ? "text-chalk font-semibold" : "text-slate"}`}>
            Noor &amp; Sam
          </div>
        </div>
      </div>
      {isFinal && (
        <div className="mt-4 pt-4 border-t border-white/5 text-xs text-slate flex items-center gap-1.5">
          <span className="text-amber">●</span> Maya &amp; Leo win — logged in 4 seconds
        </div>
      )}
    </div>
  );
}
