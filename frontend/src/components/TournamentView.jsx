import { useState } from "react";
import { Plus, Trophy, X } from "lucide-react";
import { api } from "../api";
import Avatar from "./Avatar";
import RankRow from "./RankRow";

const emptySet = () => ({ side1_score: "", side2_score: "" });

export const STATUS = {
  draft: { label: "Draft", cls: "bg-soft text-muted" },
  in_progress: { label: "In progress", cls: "bg-brand-soft text-brand" },
  completed: { label: "Completed", cls: "bg-win-soft text-win" },
};

export function StatusChip({ status }) {
  const s = STATUS[status] || STATUS.draft;
  return <span className={`chip ${s.cls}`}>{s.label}</span>;
}

// Title card shared by the in-app and public tournament screens.
export function TournamentHero({ tournament, children }) {
  return (
    <section className="card p-5">
      <div className="flex flex-wrap items-center gap-1.5">
        <StatusChip status={tournament.status} />
        <span className="chip capitalize">{tournament.match_type}</span>
        <span className="chip">Round robin</span>
      </div>
      <h1 className="mt-3 break-words text-[28px] font-extrabold leading-tight tracking-tight">{tournament.name}</h1>
      {children}
    </section>
  );
}

function FixtureTeam({ entry, won, scores, opponentScores }) {
  const names = entry.name.split(" & ");
  return (
    <div className="flex items-center gap-3">
      <span className="flex shrink-0 -space-x-2">
        {names.map((n, i) => (
          <Avatar key={i} name={n} size={names.length > 1 ? 28 : 34} className="ring-2 ring-white" />
        ))}
      </span>
      <span className={`min-w-0 flex-1 truncate text-[15px] ${won ? "font-bold" : "font-medium"}`}>{entry.name}</span>
      {won && <Trophy size={15} className="shrink-0 text-gold" aria-label="Winner" />}
      <span className="flex shrink-0 gap-3">
        {scores.map((s, i) => (
          <span key={i} className={`num w-6 text-center text-[15px] ${s > opponentScores[i] ? "font-extrabold" : "text-muted"}`}>
            {s}
          </span>
        ))}
      </span>
    </div>
  );
}

function RecordResultForm({ tournamentId, fixture, onRecorded }) {
  const [sets, setSets] = useState([emptySet()]);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const updateSet = (idx, key, value) => {
    setSets((prev) => prev.map((s, i) => (i === idx ? { ...s, [key]: value } : s)));
  };
  const addSet = () => setSets((prev) => [...prev, emptySet()]);
  const removeSet = (idx) => setSets((prev) => prev.filter((_, i) => i !== idx));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    const parsedSets = sets
      .filter((s) => s.side1_score !== "" && s.side2_score !== "")
      .map((s) => ({ side1_score: Number(s.side1_score), side2_score: Number(s.side2_score) }));
    if (parsedSets.length === 0) return setError("Enter at least one set score.");
    setSaving(true);
    try {
      await api.recordFixtureResult(tournamentId, fixture.id, {
        played_at: new Date().toISOString().slice(0, 10),
        sets: parsedSets,
      });
      onRecorded();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const scoreInput = "input num !h-12 text-center text-lg font-extrabold";

  return (
    <form onSubmit={handleSubmit} className="mt-4 border-t border-line pt-4">
      <p className="mb-2 text-xs font-semibold text-muted">Result (top team – bottom team)</p>
      <div className="space-y-2">
        {sets.map((s, idx) => (
          <div key={idx} className="flex items-center gap-2">
            <input
              type="number"
              inputMode="numeric"
              min="0"
              aria-label={`Set ${idx + 1}, ${fixture.entry1.name} score`}
              value={s.side1_score}
              onChange={(e) => updateSet(idx, "side1_score", e.target.value)}
              placeholder="0"
              className={scoreInput}
            />
            <span className="font-bold text-faint">–</span>
            <input
              type="number"
              inputMode="numeric"
              min="0"
              aria-label={`Set ${idx + 1}, ${fixture.entry2.name} score`}
              value={s.side2_score}
              onChange={(e) => updateSet(idx, "side2_score", e.target.value)}
              placeholder="0"
              className={scoreInput}
            />
            {sets.length > 1 && (
              <button
                type="button"
                onClick={() => removeSet(idx)}
                aria-label={`Remove set ${idx + 1}`}
                className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-soft text-muted hover:bg-loss-soft hover:text-loss"
              >
                <X size={16} />
              </button>
            )}
          </div>
        ))}
      </div>
      {error && <p role="alert" className="mt-2 text-sm font-medium text-loss">{error}</p>}
      <div className="mt-3 flex gap-2">
        <button type="button" onClick={addSet} className="btn h-10 bg-soft px-4 text-sm text-ink hover:bg-line/70">
          <Plus size={16} strokeWidth={2.6} /> Set
        </button>
        <button type="submit" disabled={saving} className="btn h-10 flex-1 bg-ink px-4 text-sm text-white">
          {saving ? "Saving…" : "Record result"}
        </button>
      </div>
    </form>
  );
}

export default function TournamentView({ tournament, canRecordResults, onChanged }) {
  const rounds = [...new Set(tournament.fixtures.map((f) => f.round))].sort((a, b) => a - b);

  return (
    <div className="space-y-7">
      <section className="card p-4">
        <h2 className="section-title mb-2 px-1">Standings</h2>
        <ol className="space-y-1">
          {tournament.standings.map((s, i) => (
            <RankRow
              key={s.id}
              rank={i + 1}
              names={s.name.split(" & ")}
              record={`${s.games} played`}
              value={`${s.wins}–${s.losses}`}
            />
          ))}
        </ol>
      </section>

      {rounds.map((round) => {
        const fixtures = tournament.fixtures.filter((f) => f.round === round);
        const played = fixtures.filter((f) => f.played).length;
        return (
          <section key={round}>
            <div className="mb-3 flex items-baseline justify-between px-1">
              <h2 className="section-title">Round {round}</h2>
              <span className="num text-xs font-medium text-muted">
                {played}/{fixtures.length} played
              </span>
            </div>
            <ul className="space-y-3">
              {fixtures.map((f) => {
                const s1 = f.sets.map((s) => s.side1_score);
                const s2 = f.sets.map((s) => s.side2_score);
                return (
                  <li key={f.id} className="card p-4">
                    <div className="space-y-2">
                      <FixtureTeam entry={f.entry1} won={f.winnerEntryId === f.entry1.id} scores={s1} opponentScores={s2} />
                      <FixtureTeam entry={f.entry2} won={f.winnerEntryId === f.entry2.id} scores={s2} opponentScores={s1} />
                    </div>
                    {!f.played && canRecordResults && (
                      <RecordResultForm tournamentId={tournament.id} fixture={f} onRecorded={onChanged} />
                    )}
                    {!f.played && !canRecordResults && <p className="mt-3 text-xs font-medium text-faint">Yet to be played</p>}
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
