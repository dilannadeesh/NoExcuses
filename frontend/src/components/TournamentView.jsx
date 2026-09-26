import { useState } from "react";
import { api } from "../api";

const emptySet = () => ({ side1_score: "", side2_score: "" });

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

  return (
    <form onSubmit={handleSubmit} className="mt-2 space-y-1.5">
      {sets.map((s, idx) => (
        <div key={idx} className="flex items-center gap-2">
          <input
            type="number"
            min="0"
            value={s.side1_score}
            onChange={(e) => updateSet(idx, "side1_score", e.target.value)}
            placeholder="0"
            className="scoreboard-digit w-14 bg-courtink border border-white/10 rounded-sm px-2 py-1 text-center text-sm focus:outline-none focus:border-amber"
          />
          <span className="text-slate">–</span>
          <input
            type="number"
            min="0"
            value={s.side2_score}
            onChange={(e) => updateSet(idx, "side2_score", e.target.value)}
            placeholder="0"
            className="scoreboard-digit w-14 bg-courtink border border-white/10 rounded-sm px-2 py-1 text-center text-sm focus:outline-none focus:border-amber"
          />
          {sets.length > 1 && (
            <button type="button" onClick={() => removeSet(idx)} className="text-slate hover:text-fault text-xs">
              remove
            </button>
          )}
          {idx === sets.length - 1 && (
            <button type="button" onClick={addSet} className="text-amber text-xs font-semibold ml-1">
              + set
            </button>
          )}
        </div>
      ))}
      <div className="flex items-center gap-2">
        <button
          type="submit"
          disabled={saving}
          className="bg-amber text-courtink text-xs font-semibold px-3 py-1.5 rounded-sm hover:bg-chalk transition-colors disabled:opacity-50"
        >
          {saving ? "Saving…" : "Record result"}
        </button>
        {error && <span className="text-fault text-xs">{error}</span>}
      </div>
    </form>
  );
}

export default function TournamentView({ tournament, canRecordResults, onChanged }) {
  const rounds = [...new Set(tournament.fixtures.map((f) => f.round))].sort((a, b) => a - b);

  return (
    <div>
      <div className="flex flex-wrap gap-3 mb-8">
        <div className="flex-1 min-w-[200px] bg-courtink-2 border border-white/5 rounded-sm px-5 py-4">
          <div className="text-[11px] uppercase tracking-[0.18em] text-slate font-semibold mb-2">Standings</div>
          <ol className="space-y-1.5">
            {tournament.standings.map((s, i) => (
              <li key={s.id} className="flex items-center gap-2 text-sm">
                <span className="scoreboard-digit text-slate w-4 text-right">{i + 1}</span>
                <span className={`flex-1 truncate ${i === 0 ? "text-chalk font-semibold" : "text-chalk/90"}`}>
                  {s.name}
                </span>
                <span className="scoreboard-digit text-amber font-semibold">
                  {s.wins}–{s.losses}
                </span>
              </li>
            ))}
          </ol>
        </div>
      </div>

      <div className="space-y-8">
        {rounds.map((round) => (
          <div key={round}>
            <div className="text-[11px] uppercase tracking-[0.15em] text-slate font-semibold mb-3">
              Round {round}
            </div>
            <div className="space-y-2">
              {tournament.fixtures
                .filter((f) => f.round === round)
                .map((f) => (
                  <div key={f.id} className="bg-courtink-2 border border-white/5 rounded-sm px-4 py-3">
                    <div className="flex items-center justify-between gap-3 text-sm">
                      <span className={f.winnerEntryId === f.entry1.id ? "text-chalk font-semibold" : "text-slate"}>
                        {f.entry1.name}
                      </span>
                      {f.played ? (
                        <span className="scoreboard-digit text-slate text-xs shrink-0">
                          {f.sets.map((s) => `${s.side1_score}-${s.side2_score}`).join("  ")}
                        </span>
                      ) : (
                        <span className="text-slate text-xs shrink-0">vs</span>
                      )}
                      <span className={f.winnerEntryId === f.entry2.id ? "text-chalk font-semibold" : "text-slate"}>
                        {f.entry2.name}
                      </span>
                    </div>
                    {!f.played && canRecordResults && (
                      <RecordResultForm tournamentId={tournament.id} fixture={f} onRecorded={onChanged} />
                    )}
                  </div>
                ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
