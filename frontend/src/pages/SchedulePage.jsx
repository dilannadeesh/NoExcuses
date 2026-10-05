import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { CalendarClock, Check, Coffee, Copy, MessageCircle, Minus, Plus, RefreshCw, Send, Share2 } from "lucide-react";
import { api } from "../api";
import { useAuth } from "../context/AuthContext";
import Avatar from "../components/Avatar";
import Screen from "../components/Screen";
import { LoadingBlock, ErrorNote } from "../components/States";
import { todayKey } from "../lib/day";
import { buildShareText, telegramUrl, textForLink, whatsappUrl } from "../lib/scheduleText";
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

// what the server stored -> what the page renders
const resultFrom = (s) => ({
  schedule: s.data.schedule,
  players: s.data.players,
  startTime: s.startTime,
  updatedAt: s.updatedAt,
  byName: s.byName,
});

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

function TeamLine({ ids, nameOf, meId }) {
  const names = ids.map(nameOf);
  return (
    <div className="flex items-center gap-2.5">
      <span className="flex shrink-0">
        {names.map((n, i) => (
          <Avatar key={i} name={n} size={28} className={`ring-2 ring-white ${i > 0 ? "-ml-2" : ""}`} />
        ))}
      </span>
      <span className="min-w-0 flex-1 truncate text-[15px] font-medium">
        {ids.map((id, i) => (
          <span key={id} className={id === meId ? "font-bold text-brand" : ""}>
            {i > 0 && <span className="font-medium text-ink"> &amp; </span>}
            {names[i]}
          </span>
        ))}
      </span>
    </div>
  );
}

// Bottom sheet: WhatsApp, Telegram, copy, and the phone's own share menu.
function ShareSheet({ onClose, whatsapp, telegram, fullText, nativeShare }) {
  const [copied, setCopied] = useState(false);
  const firstRef = useRef(null);

  useEffect(() => {
    firstRef.current?.focus();
    const onKey = (e) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(fullText);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      window.prompt("Copy the schedule", fullText); // clipboard needs https / a user gesture
    }
  };

  const row = "btn-secondary !h-12 w-full justify-start !px-4 text-[15px]";
  return (
    <div className="fixed inset-0 z-40" role="dialog" aria-modal="true" aria-label="Share today's schedule">
      <button type="button" aria-label="Close" tabIndex={-1} onClick={onClose} className="absolute inset-0 bg-ink/40" />
      <div className="absolute inset-x-0 bottom-0 mx-auto max-w-md rounded-t-2xl bg-white p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] shadow-card md:max-w-xl">
        <h2 className="section-title">Share today’s schedule</h2>
        <p className="mb-4 mt-1 text-sm text-muted">Send it to the group chat so everyone knows when they’re on.</p>
        <div className="space-y-2">
          <a ref={firstRef} href={whatsapp} target="_blank" rel="noopener noreferrer" className={row}>
            <MessageCircle size={20} /> WhatsApp
          </a>
          <a href={telegram} target="_blank" rel="noopener noreferrer" className={row}>
            <Send size={20} /> Telegram
          </a>
          <button type="button" onClick={copy} className={row}>
            {copied ? <Check size={20} /> : <Copy size={20} />} {copied ? "Copied" : "Copy text"}
          </button>
          {nativeShare && (
            <button type="button" onClick={nativeShare} className={row}>
              <Share2 size={20} /> More apps…
            </button>
          )}
        </div>
        <button type="button" onClick={onClose} className="btn mt-3 h-11 w-full text-sm text-muted">
          Close
        </button>
      </div>
    </div>
  );
}

// ------------------------------------------------------------------ page

export default function SchedulePage() {
  const { groupId } = useParams();
  const { user } = useAuth();
  const [today] = useState(todayKey);
  const [group, setGroup] = useState(null);
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // 0 = nothing planned (members), 1/2 = the planning wizard, 3 = the schedule
  const [step, setStep] = useState(0);
  const [selected, setSelected] = useState(() => new Set());
  const [mode, setMode] = useState("doubles");
  const [courts, setCourts] = useState(2);
  const [startTime, setStartTime] = useState(nextQuarterHour);
  const [result, setResult] = useState(null); // { schedule, players, startTime, updatedAt, byName }
  const [busy, setBusy] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);

  const canManage = group?.role === "owner" || group?.role === "admin";

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [g, m] = await Promise.all([api.getGroupWithSchedule(groupId), api.listMembers(groupId)]);
        if (cancelled) return;
        setGroup(g);
        setMembers(m);
        const manage = g.role === "owner" || g.role === "admin";
        const s = g.schedule;
        const ids = new Set(m.map((x) => x.id));

        // a saved plan (today's or an older one) pre-fills the setup, which is
        // handy for a group that plays the same night every week
        if (s) {
          setSelected(new Set(s.data.players.map((p) => p.id).filter((id) => ids.has(id))));
          setMode(s.mode);
          setCourts(s.courts);
        }
        if (s && s.date === today) {
          setStartTime(s.startTime || "");
          setResult(resultFrom(s));
          setStep(3);
        } else {
          setStep(manage ? 1 : 0);
        }
      } catch (e) {
        if (!cancelled) setError(e.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [groupId, today]);

  // Re-read the plan (viewers see changes the admin makes; the admin sees if
  // another admin changed it). Quietly keeps what's on screen if the fetch fails.
  const refresh = useCallback(async () => {
    try {
      const g = await api.getGroupWithSchedule(groupId);
      const s = g.schedule;
      setGroup((prev) => ({ ...prev, ...g }));
      if (s && s.date === today) {
        setResult((prev) => (prev && prev.updatedAt === s.updatedAt ? prev : resultFrom(s)));
        setStep(3);
      } else {
        setResult(null);
        setStep((cur) => (cur === 3 ? (g.role === "owner" || g.role === "admin" ? 1 : 0) : cur));
      }
    } catch {
      /* keep showing what we have */
    }
  }, [groupId, today]);

  useEffect(() => {
    if (step !== 3 && step !== 0) return;
    const onVisible = () => document.visibilityState === "visible" && refresh();
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [step, refresh]);

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

  const toggle = (id) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  // Build the plan and save it for the whole group.
  const generate = async () => {
    setError("");
    setBusy(true);
    try {
      // fresh ratings every time, so games logged since this page opened count
      const a = await api.getAnalytics(groupId);
      const rated = new Map((a.playerStats || []).filter((p) => Number.isFinite(p.eloRating)).map((p) => [p.id, p.eloRating]));
      const players = sortedMembers
        .filter((m) => selected.has(m.id))
        .map((m) => ({ id: m.id, name: m.name, rating: rated.get(m.id) ?? DEFAULT_RATING }));
      await new Promise((r) => setTimeout(r, 0)); // let the busy state paint first
      const schedule = generateSchedule({
        players,
        mode: modeNow,
        courts: courtsNow,
        seed: Math.floor(Math.random() * 1_000_000) + 1,
      });
      const g = await api.saveSchedule(groupId, {
        date: today,
        startTime: startTime || null,
        mode: modeNow,
        courts: courtsNow,
        data: { schedule, players },
      });
      setGroup(g);
      setResult(resultFrom(g.schedule));
      setStep(3);
      window.scrollTo(0, 0);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const regenerate = () => {
    if (!confirm("Regenerate the schedule? This replaces the one your group can see.")) return;
    generate();
  };

  const removePlan = async () => {
    if (!confirm("Remove today’s schedule? Your group will no longer see it.")) return;
    setError("");
    setBusy(true);
    try {
      setGroup(await api.clearSchedule(groupId));
      setResult(null);
      setStep(1);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
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

  // ------------------------------------------- members: nothing planned yet
  if (step === 0 || (!canManage && step < 3)) {
    return (
      <Screen>
        <div className="card px-6 py-12 text-center">
          <span className="mx-auto grid h-12 w-12 place-items-center rounded-xl bg-soft text-ink">
            <CalendarClock size={22} />
          </span>
          <p className="mt-4 font-semibold">No schedule for today yet</p>
          <p className="mx-auto mt-1 max-w-xs text-sm text-muted">
            The group admin plans each session. It will show up here as soon as they do.
          </p>
          <button type="button" onClick={refresh} className="btn-secondary mx-auto mt-5">
            <RefreshCw size={16} /> Check again
          </button>
        </div>
      </Screen>
    );
  }

  // ---------------------------------------------------- step 1: who's in
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

  // ------------------------------------------------ step 2: the format
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
              {modeNow === "doubles" ? "4 players per match, in two pairs." : "2 players per match."}
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

          <p className="px-1 text-xs text-muted">Generating saves the schedule, so everyone in the group can see it in the app.</p>
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

  // ---------------------------------------------- step 3: the schedule
  const { schedule, players: snapshot, startTime: usedStart } = result;
  const nameOf = (id) => snapshot.find((p) => p.id === id)?.name ?? "Player";
  const meId = user?.id;
  const { summary } = schedule;
  const endLabel = label(usedStart, SESSION_MINUTES);
  const dateLabel = new Date().toLocaleDateString([], { weekday: "short", day: "numeric", month: "short" });
  const iAmIn = snapshot.some((p) => p.id === meId);
  const myGames = schedule.rounds.reduce((c, r) => c + r.matches.filter((m) => [...m.a, ...m.b].includes(meId)).length, 0);
  const updated = result.updatedAt
    ? new Date(result.updatedAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })
    : null;

  const appLink = `${window.location.origin}/groups/${groupId}/schedule`;
  const shareArgs = {
    title: group.name,
    subtitle: `${dateLabel}${usedStart ? ` · ${label(usedStart, 0)} – ${endLabel}` : ""} · ${schedule.mode} · ${schedule.courtsUsed} ${
      schedule.courtsUsed === 1 ? "court" : "courts"
    }`,
    rounds: schedule.rounds,
    nameOf,
    timeOf: (m) => label(usedStart, m),
  };

  const shareSheet = () => {
    const forLink = textForLink({ ...shareArgs, link: appLink });
    const noLink = textForLink({ ...shareArgs, link: null });
    return (
      <ShareSheet
        onClose={() => setShareOpen(false)}
        whatsapp={whatsappUrl(forLink.text)}
        telegram={telegramUrl(appLink, noLink.text)}
        fullText={buildShareText({ ...shareArgs, link: appLink })}
        nativeShare={
          navigator.share
            ? () =>
                navigator
                  .share({ title: `${group.name} · today's games`, text: noLink.text, url: appLink })
                  .then(() => setShareOpen(false))
                  .catch(() => {}) // the person closing the share menu isn't an error
            : null
        }
      />
    );
  };

  return (
    <Screen bottom={canManage ? "cta" : "none"}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="px-1 text-2xl font-semibold leading-tight tracking-tight">Today’s schedule</h1>
          <p className="num mt-1 px-1 text-sm text-muted">
            {group.name} · {dateLabel}
            {usedStart ? ` · ${label(usedStart, 0)} – ${endLabel}` : ""}
          </p>
        </div>
        {!canManage && (
          <button type="button" onClick={refresh} aria-label="Refresh" className="btn-secondary !h-10 !w-10 shrink-0 !px-0">
            <RefreshCw size={17} />
          </button>
        )}
      </div>
      {(result.byName || updated) && (
        <p className="mb-5 mt-1 px-1 text-xs text-muted">
          {result.byName ? `Planned by ${result.byName}` : "Planned"}
          {updated ? ` · updated ${updated}` : ""}
        </p>
      )}

      <ErrorNote className="mb-4">{error}</ErrorNote>

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
        {meId !== undefined && (
          <p className="mt-1 rounded-xl bg-brand-soft px-3 py-2 text-sm font-medium text-brand">
            {iAmIn ? `You play ${myGames} ${myGames === 1 ? "game" : "games"} — your matches are highlighted.` : "You’re not in today’s schedule."}
          </p>
        )}
        <p className="mt-2 text-xs leading-relaxed text-muted">
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

            <div className="mt-3 space-y-1">
              {round.matches.map((mt) => {
                const mine = [...mt.a, ...mt.b].includes(meId);
                return (
                  <div
                    key={mt.court}
                    data-mine={mine || undefined}
                    className={`flex items-center gap-3 rounded-xl px-2 py-2.5 ${mine ? "bg-brand-soft" : ""}`}
                  >
                    <div className="w-11 shrink-0 text-center">
                      <div className="text-[10px] font-medium uppercase tracking-wide text-muted">Court</div>
                      <div className="num text-lg font-semibold leading-tight">{mt.court}</div>
                    </div>
                    <div className="min-w-0 flex-1 space-y-2">
                      <TeamLine ids={mt.a} nameOf={nameOf} meId={meId} />
                      <TeamLine ids={mt.b} nameOf={nameOf} meId={meId} />
                    </div>
                  </div>
                );
              })}
            </div>

            {round.sitting.length > 0 && (
              <p
                data-mine={round.sitting.includes(meId) || undefined}
                className="mt-3 flex items-start gap-2 border-t border-line pt-3 text-xs text-muted"
              >
                <Coffee size={14} className="mt-px shrink-0" aria-hidden="true" />
                <span>
                  <span className="font-medium">Resting:</span>{" "}
                  {round.sitting.map((id, i) => (
                    <span key={id} className={id === meId ? "font-bold text-brand" : ""}>
                      {i > 0 && ", "}
                      {nameOf(id)}
                    </span>
                  ))}
                </span>
              </p>
            )}
          </li>
        ))}
      </ol>

      <p className="mt-5 px-1 text-center text-xs text-muted">
        {endLabel ? `Finishes about ${endLabel}. ` : ""}Games run 10–12 minutes, so each slot is {SLOT_MINUTES}.
      </p>

      {canManage && (
        <button type="button" onClick={removePlan} disabled={busy} className="btn-danger mx-auto mt-4 flex">
          Remove today’s schedule
        </button>
      )}

      {canManage && (
        <PinnedBar>
          <button type="button" onClick={() => setStep(1)} className="btn-secondary !h-12 shrink-0">
            Edit setup
          </button>
          <button
            type="button"
            onClick={regenerate}
            disabled={busy}
            aria-label="Regenerate"
            title="Regenerate"
            className="btn-secondary !h-12 !w-12 shrink-0 !px-0"
          >
            <RefreshCw size={19} className={busy ? "animate-spin" : ""} />
          </button>
          <button type="button" onClick={() => setShareOpen(true)} className="btn-primary flex-1">
            <Share2 size={18} /> Share
          </button>
        </PinnedBar>
      )}

      {shareOpen && canManage && shareSheet()}
    </Screen>
  );
}
