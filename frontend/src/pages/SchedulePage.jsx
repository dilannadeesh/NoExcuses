import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { Check, Coffee, Minus, Plus, RefreshCw } from "lucide-react";
import { api } from "../api";
import Avatar from "../components/Avatar";
import Screen from "../components/Screen";
import { LoadingBlock, ErrorNote } from "../components/States";
import {
  DEFAULT_RATING,
  ROUNDS,
  SESSION_MINUTES,
  SLOT_MINUTES,
  estimateGames,
  generateSchedule,
  maxCourts,
  playersPerMatch,
} from "../lib/scheduler";

// ---------------------------------------------------------------- helpers

const todayKey = () => new Date().toLocaleDateString("en-CA"); // local YYYY-MM-DD
const storageKey = (groupId) => `noexcuses:schedule:${groupId}:${todayKey()}`;

// The plan is saved on this device for the day, so a refresh (or a phone
// locking at the courts) doesn't lose it. Storage can be unavailable or full;
// the page works fine without it.
function loadSaved(groupId) {
  try {
    const raw = localStorage.getItem(storageKey(groupId));
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}
function saveDay(groupId, data) {
  try {
    const prefix = `noexcuses:schedule:${groupId}:`;
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const k = localStorage.key(i);
      if (k && k.startsWith(prefix) && k !== storageKey(groupId)) localStorage.removeItem(k); // older days
    }
    localStorage.setItem(storageKey(groupId), JSON.stringify(data));
  } catch {
    /* ignore */
  }
}

function nextQuarterHour() {
  const d = new Date();
  d.setMinutes(Math.ceil((d.getMinutes() + 1) / 15) * 15, 0, 0);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function clock(startTime, addMinutes) {
  if (!startTime) return null;
  const [h, m] = startTime.split(":").map(Number);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return null;
  const d = new Date();
  d.setHours(h, m + addMinutes, 0, 0);
  return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

const elapsed = (min) => `${Math.floor(min / 60)}:${String(min % 60).padStart(2, "0")}`;
const label = (startTime, min) => clock(startTime, min) ?? elapsed(min);

// -------------------------------------------------------------- small UI

function PinnedBar({ children, note }) {
  return (
    <div className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-white pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3">
      <div className="mx-auto max-w-md px-5 md:max-w-xl">
        {note && <p className="mb-2 text-center text-xs text-muted">{note}</p>}
        <div className="flex gap-2">{children}</div>
      </div>
    </div>
  );
}

function TeamLine({ ids, nameOf }) {
  const names = ids.map(nameOf);
  return (
    <div className="flex items-center gap-2.5">
      <span className="flex shrink-0">
        {names.map((n, i) => (
          <Avatar key={i} name={n} size={28} className={`ring-2 ring-white ${i > 0 ? "-ml-2" : ""}`} />
        ))}
      </span>
      <span className="min-w-0 flex-1 truncate text-[15px] font-medium">{names.join(" & ")}</span>
    </div>
  );
}

// ------------------------------------------------------------------ page

export default function SchedulePage() {
  const { groupId } = useParams();
  const [group, setGroup] = useState(null);
  const [members, setMembers] = useState([]);
  const [ratings, setRatings] = useState(() => new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [step, setStep] = useState(1);
  const [selected, setSelected] = useState(() => new Set());
  const [mode, setMode] = useState("doubles");
  const [courts, setCourts] = useState(2);
  const [startTime, setStartTime] = useState(nextQuarterHour);
  const [result, setResult] = useState(null); // { schedule, players, startTime }
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    Promise.all([api.getGroup(groupId), api.listMembers(groupId), api.getAnalytics(groupId)])
      .then(([g, m, a]) => {
        if (cancelled) return;
        setGroup(g);
        setMembers(m);
        // Skill = the Elo rating the app already computes. Players with no
        // games yet aren't in the stats; they get the default.
        setRatings(new Map((a.playerStats || []).filter((p) => Number.isFinite(p.eloRating)).map((p) => [p.id, p.eloRating])));

        const saved = loadSaved(groupId);
        if (saved) {
          const ids = new Set(m.map((x) => x.id));
          setSelected(new Set((saved.selected || []).filter((id) => ids.has(id))));
          if (saved.mode === "singles" || saved.mode === "doubles") setMode(saved.mode);
          if (Number.isFinite(saved.courts)) setCourts(saved.courts);
          if (typeof saved.startTime === "string") setStartTime(saved.startTime);
          if (saved.result?.schedule?.rounds?.length) {
            setResult(saved.result);
            setStep(3);
          }
        }
      })
      .catch((e) => !cancelled && setError(e.message))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [groupId]);

  const sortedMembers = useMemo(
    () => [...members].sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" })),
    [members]
  );

  const n = selected.size;
  const canDoubles = n >= 4;
  // If the field shrinks below 4, doubles isn't possible any more.
  const modeNow = mode === "doubles" && !canDoubles ? "singles" : mode;
  const ppm = playersPerMatch(modeNow);
  const maxC = Math.max(1, maxCourts(n, modeNow));
  const courtsNow = Math.min(courts, maxC);
  const estimate = estimateGames(n, modeNow, courtsNow);

  const persist = (nextResult, overrides = {}) =>
    saveDay(groupId, {
      selected: [...selected],
      mode: modeNow,
      courts: courtsNow,
      startTime,
      result: nextResult,
      ...overrides,
    });

  const toggle = (id) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const generate = () => {
    setError("");
    setBusy(true);
    // yield a frame so the button can show its busy state before the work runs
    setTimeout(() => {
      try {
        const players = sortedMembers
          .filter((m) => selected.has(m.id))
          .map((m) => ({ id: m.id, name: m.name, rating: ratings.get(m.id) ?? DEFAULT_RATING }));
        const schedule = generateSchedule({
          players,
          mode: modeNow,
          courts: courtsNow,
          seed: Math.floor(Math.random() * 1_000_000) + 1,
        });
        const next = { schedule, players, startTime };
        setResult(next);
        setStep(3);
        persist(next);
        window.scrollTo(0, 0);
      } catch (e) {
        setError(e.message);
      } finally {
        setBusy(false);
      }
    }, 30);
  };

  if (loading) {
    return (
      <Screen>
        <LoadingBlock rows={4} />
      </Screen>
    );
  }
  if (error && !group) {
    return (
      <Screen>
        <ErrorNote>{error}</ErrorNote>
      </Screen>
    );
  }

  // ---------------------------------------------------------- step 1: who's in
  if (step === 1) {
    return (
      <Screen bottom="cta">
        <p className="px-1 text-xs font-medium text-muted">Step 1 of 2</p>
        <h1 className="px-1 text-2xl font-semibold leading-tight tracking-tight">Who’s in today?</h1>
        <p className="mb-5 mt-1 px-1 text-sm text-muted">{group.name} · tap everyone who’s playing</p>

        {sortedMembers.length === 0 ? (
          <div className="card px-6 py-10 text-center">
            <p className="font-semibold">No players in this group yet</p>
            <p className="mt-1 text-sm text-muted">Add members first, then come back to plan the night.</p>
          </div>
        ) : (
          <>
            <div className="mb-3 flex items-center justify-between px-1">
              <p className="num text-sm font-medium">
                {n} of {sortedMembers.length} selected
              </p>
              <button
                type="button"
                onClick={() => setSelected(n === sortedMembers.length ? new Set() : new Set(sortedMembers.map((m) => m.id)))}
                className="btn-secondary btn-sm"
              >
                {n === sortedMembers.length ? "Clear" : "Select all"}
              </button>
            </div>
            <ul className="card divide-y divide-line px-1 py-1">
              {sortedMembers.map((m) => {
                const on = selected.has(m.id);
                return (
                  <li key={m.id}>
                    <button
                      type="button"
                      role="checkbox"
                      aria-checked={on}
                      onClick={() => toggle(m.id)}
                      className="flex min-h-[56px] w-full items-center gap-3 rounded-xl px-3 py-2 text-left transition active:bg-soft"
                    >
                      <Avatar name={m.name} size={40} />
                      <span className="min-w-0 flex-1">
                        <span className={`block truncate text-[15px] ${on ? "font-semibold" : "font-medium"}`}>{m.name}</span>
                        {!m.has_joined && <span className="text-xs text-muted">Hasn’t signed up yet</span>}
                      </span>
                      <span
                        aria-hidden="true"
                        className={`grid h-6 w-6 shrink-0 place-items-center rounded-full transition ${
                          on ? "bg-ink text-white" : "border-2 border-line"
                        }`}
                      >
                        {on && <Check size={14} strokeWidth={3} />}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </>
        )}

        <PinnedBar note={n < 2 ? "Select at least 2 players to continue" : null}>
          <button type="button" onClick={() => setStep(2)} disabled={n < 2} className="btn-primary flex-1">
            Next
          </button>
        </PinnedBar>
      </Screen>
    );
  }

  // ------------------------------------------------------- step 2: the format
  if (step === 2) {
    const resting = n - estimate.courtsUsed * ppm;
    return (
      <Screen bottom="cta">
        <p className="px-1 text-xs font-medium text-muted">Step 2 of 2</p>
        <h1 className="px-1 text-2xl font-semibold leading-tight tracking-tight">How are you playing?</h1>
        <p className="mb-5 mt-1 px-1 text-sm text-muted">{n} players in</p>

        <div className="space-y-4">
          <section className="card p-4">
            <h2 className="section-title mb-3">Game type</h2>
            <div className="seg" role="tablist" aria-label="Game type">
              {["singles", "doubles"].map((t) => (
                <button
                  key={t}
                  type="button"
                  role="tab"
                  aria-selected={modeNow === t}
                  disabled={t === "doubles" && !canDoubles}
                  onClick={() => setMode(t)}
                  className={`seg-item capitalize disabled:opacity-40 ${modeNow === t ? "seg-item-active" : ""}`}
                >
                  {t}
                </button>
              ))}
            </div>
            <p className="mt-2.5 text-xs text-muted">
              {modeNow === "doubles"
                ? "4 players per match, in two pairs."
                : "2 players per match."}
              {!canDoubles && " Doubles needs at least 4 players."}
            </p>
          </section>

          <section className="card p-4">
            <h2 className="section-title mb-3">Courts</h2>
            <div className="flex items-center justify-between gap-4">
              <p className="text-sm text-muted">
                Up to <span className="num font-semibold text-ink">{maxC}</span> with {n} players
              </p>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  aria-label="Fewer courts"
                  disabled={courtsNow <= 1}
                  onClick={() => setCourts(Math.max(1, courtsNow - 1))}
                  className="btn-secondary !h-11 !w-11 !px-0"
                >
                  <Minus size={18} />
                </button>
                <span aria-live="polite" className="num w-8 text-center text-2xl font-semibold">
                  {courtsNow}
                </span>
                <button
                  type="button"
                  aria-label="More courts"
                  disabled={courtsNow >= maxC}
                  onClick={() => setCourts(Math.min(maxC, courtsNow + 1))}
                  className="btn-secondary !h-11 !w-11 !px-0"
                >
                  <Plus size={18} />
                </button>
              </div>
            </div>
          </section>

          <section className="card p-4">
            <label htmlFor="start-time" className="section-title mb-3 block">
              Start time
            </label>
            <input id="start-time" type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} className="input" />
          </section>

          <section className="rounded-2xl bg-brand-soft px-4 py-3.5 text-sm text-brand">
            <p className="font-semibold">
              {ROUNDS} rounds · about {estimate.min === estimate.max ? estimate.min : `${estimate.min}–${estimate.max}`} games each
            </p>
            <p className="mt-0.5 text-brand/80">
              {SLOT_MINUTES}-minute slots for {SESSION_MINUTES / 60} hours, one set per game
              {resting > 0 ? ` · ${resting} resting each round` : " · everyone plays every round"}.
            </p>
          </section>

          <ErrorNote>{error}</ErrorNote>
        </div>

        <PinnedBar>
          <button type="button" onClick={() => setStep(1)} className="btn-secondary !h-12 shrink-0">
            Back
          </button>
          <button type="button" onClick={generate} disabled={busy || n < ppm} className="btn-primary flex-1">
            {busy ? "Generating…" : "Generate schedule"}
          </button>
        </PinnedBar>
      </Screen>
    );
  }

  // ------------------------------------------------------- step 3: the schedule
  const { schedule, players: snapshot, startTime: usedStart } = result;
  const nameOf = (id) => snapshot.find((p) => p.id === id)?.name ?? "Player";
  const { summary } = schedule;
  const endLabel = label(usedStart, SESSION_MINUTES);
  const dateLabel = new Date().toLocaleDateString([], { weekday: "short", day: "numeric", month: "short" });

  return (
    <Screen bottom="cta">
      <h1 className="px-1 text-2xl font-semibold leading-tight tracking-tight">Today’s schedule</h1>
      <p className="num mb-5 mt-1 px-1 text-sm text-muted">
        {group.name} · {dateLabel}
        {usedStart ? ` · ${label(usedStart, 0)} – ${endLabel}` : ""}
      </p>

      <section className="card p-4">
        <div className="flex flex-wrap gap-1.5">
          <span className="chip">{ROUNDS} rounds</span>
          <span className="chip">{SLOT_MINUTES} min each</span>
          <span className="chip">
            {schedule.courtsUsed} {schedule.courtsUsed === 1 ? "court" : "courts"}
          </span>
          <span className="chip capitalize">{schedule.mode}</span>
          <span className="chip">{snapshot.length} players</span>
        </div>
        <p className="mt-3 text-sm font-medium">
          Everyone plays {summary.minGames === summary.maxGames ? summary.minGames : `${summary.minGames}–${summary.maxGames}`} games
        </p>
        <p className="mt-1 text-xs leading-relaxed text-muted">
          Matches are balanced on each player’s skill rating from past games (new players start at {DEFAULT_RATING}). Average rating
          gap between sides: <span className="num font-medium text-ink">{Math.round(summary.avgGap)}</span>.
        </p>
        {schedule.courtsUsed < schedule.courtsRequested && (
          <p className="mt-2 rounded-xl bg-warn-soft px-3 py-2 text-xs font-medium text-warn">
            Only {schedule.courtsUsed} of {schedule.courtsRequested} courts are in use — {snapshot.length} players can fill at most{" "}
            {schedule.courtsUsed}.
          </p>
        )}
      </section>

      <ol className="mt-4 space-y-3">
        {schedule.rounds.map((round) => (
          <li key={round.index} className="card p-4">
            <div className="flex items-baseline justify-between">
              <h2 className="section-title">Round {round.index}</h2>
              <span className="num text-sm text-muted">{label(usedStart, round.startMinute)}</span>
            </div>

            <div className="mt-3 divide-y divide-line">
              {round.matches.map((mt) => (
                <div key={mt.court} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
                  <div className="w-11 shrink-0 text-center">
                    <div className="text-[10px] font-medium uppercase tracking-wide text-muted">Court</div>
                    <div className="num text-lg font-semibold leading-tight">{mt.court}</div>
                  </div>
                  <div className="min-w-0 flex-1 space-y-2">
                    <TeamLine ids={mt.a} nameOf={nameOf} />
                    <TeamLine ids={mt.b} nameOf={nameOf} />
                  </div>
                </div>
              ))}
            </div>

            {round.sitting.length > 0 && (
              <p className="mt-3 flex items-start gap-2 border-t border-line pt-3 text-xs text-muted">
                <Coffee size={14} className="mt-px shrink-0" aria-hidden="true" />
                <span>
                  <span className="font-medium">Resting:</span> {round.sitting.map(nameOf).join(", ")}
                </span>
              </p>
            )}
          </li>
        ))}
      </ol>

      <p className="mt-5 px-1 text-center text-xs text-muted">
        {endLabel ? `Finishes about ${endLabel}. ` : ""}Games run 10–12 minutes, so each slot is {SLOT_MINUTES}.
      </p>

      <PinnedBar>
        <button type="button" onClick={() => setStep(1)} className="btn-secondary !h-12 shrink-0">
          Edit setup
        </button>
        <button type="button" onClick={generate} disabled={busy} className="btn-primary flex-1">
          <RefreshCw size={17} className={busy ? "animate-spin" : ""} /> {busy ? "Generating…" : "Regenerate"}
        </button>
      </PinnedBar>
    </Screen>
  );
}
