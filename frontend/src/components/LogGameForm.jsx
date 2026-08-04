import { useState } from "react";
import { api } from "../api";

const emptySet = () => ({ side1_score: "", side2_score: "" });

export default function LogGameForm({ groupId, members, onSaved }) {
  const [matchType, setMatchType] = useState("doubles");
  const [playedAt, setPlayedAt] = useState(() => new Date().toISOString().slice(0, 10));
  const [side1, setSide1] = useState([]);
  const [side2, setSide2] = useState([]);
  const [sets, setSets] = useState([emptySet(), emptySet()]);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const slotsPerSide = matchType === "singles" ? 1 : 2;

  const toggleSelect = (side, playerId) => {
    const setSide = side === 1 ? setSide1 : setSide2;
    const current = side === 1 ? side1 : side2;
    if (current.includes(playerId)) {
      setSide(current.filter((id) => id !== playerId));
    } else if (current.length < slotsPerSide) {
      setSide([...current, playerId]);
    }
  };

  const handleMatchType = (type) => {
    setMatchType(type);
    setSide1([]);
    setSide2([]);
  };

  const updateSet = (idx, key, value) => {
    setSets((prev) => prev.map((s, i) => (i === idx ? { ...s, [key]: value } : s)));
  };

  const addSet = () => setSets((prev) => [...prev, emptySet()]);
  const removeSet = (idx) => setSets((prev) => prev.filter((_, i) => i !== idx));

  const reset = () => {
    setSide1([]);
    setSide2([]);
    setSets([emptySet(), emptySet()]);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (side1.length !== slotsPerSide || side2.length !== slotsPerSide) {
      setError(`Pick ${slotsPerSide} player(s) per side.`);
      return;
    }
    const overlap = side1.some((id) => side2.includes(id));
    if (overlap) {
      setError("A player can't be on both sides.");
      return;
    }
    const parsedSets = sets
      .filter((s) => s.side1_score !== "" && s.side2_score !== "")
      .map((s) => ({ side1_score: Number(s.side1_score), side2_score: Number(s.side2_score) }));
    if (parsedSets.length === 0) {
      setError("Enter at least one set score.");
      return;
    }

    setSaving(true);
    try {
      await api.createGame(groupId, { match_type: matchType, played_at: playedAt, side1, side2, sets: parsedSets });
      reset();
      onSaved();
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  if (members.length < 2) {
    return (
      <p className="text-slate text-sm py-6">Add at least 2 players to this group before logging a game.</p>
    );
  }

  const renderSideSelector = (side) => {
    const selected = side === 1 ? side1 : side2;
    return (
      <div className="flex-1">
        <div className="text-[11px] uppercase tracking-[0.15em] text-slate font-semibold mb-2">
          Side {side} {selected.length > 0 && <span className="text-amber">({selected.length}/{slotsPerSide})</span>}
        </div>
        <div className="flex flex-wrap gap-2">
          {members.map((m) => {
            const isSelected = selected.includes(m.id);
            const isDisabledByOtherSide = (side === 1 ? side2 : side1).includes(m.id);
            return (
              <button
                type="button"
                key={m.id}
                disabled={isDisabledByOtherSide}
                onClick={() => toggleSelect(side, m.id)}
                className={`px-3 py-1.5 rounded-full text-sm border transition-colors ${
                  isSelected
                    ? "bg-amber text-courtink border-amber font-semibold"
                    : isDisabledByOtherSide
                    ? "border-white/5 text-slate/40 cursor-not-allowed"
                    : "border-white/15 text-chalk hover:border-amber/60"
                }`}
              >
                {m.name}
              </button>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="flex flex-wrap items-center gap-4">
        <div className="inline-flex rounded-sm border border-white/10 overflow-hidden">
          {["singles", "doubles"].map((t) => (
            <button
              type="button"
              key={t}
              onClick={() => handleMatchType(t)}
              className={`px-4 py-2 text-sm font-semibold capitalize transition-colors ${
                matchType === t ? "bg-court text-chalk" : "text-slate hover:text-chalk"
              }`}
            >
              {t}
            </button>
          ))}
        </div>
        <label className="flex items-center gap-2 text-sm text-slate">
          Date
          <input
            type="date"
            value={playedAt}
            onChange={(e) => setPlayedAt(e.target.value)}
            className="bg-courtink-2 border border-white/10 rounded-sm px-2 py-1.5 text-chalk focus:outline-none focus:border-amber"
          />
        </label>
      </div>

      <div className="flex flex-col md:flex-row gap-6">
        {renderSideSelector(1)}
        <div className="hidden md:flex items-center justify-center text-slate font-display text-2xl">VS</div>
        {renderSideSelector(2)}
      </div>

      <div>
        <div className="text-[11px] uppercase tracking-[0.15em] text-slate font-semibold mb-2">Set scores</div>
        <div className="space-y-2">
          {sets.map((s, idx) => (
            <div key={idx} className="flex items-center gap-2">
              <span className="text-slate text-xs w-10">Set {idx + 1}</span>
              <input
                type="number"
                min="0"
                value={s.side1_score}
                onChange={(e) => updateSet(idx, "side1_score", e.target.value)}
                placeholder="0"
                className="scoreboard-digit w-16 bg-courtink-2 border border-white/10 rounded-sm px-2 py-1.5 text-center focus:outline-none focus:border-amber"
              />
              <span className="text-slate">–</span>
              <input
                type="number"
                min="0"
                value={s.side2_score}
                onChange={(e) => updateSet(idx, "side2_score", e.target.value)}
                placeholder="0"
                className="scoreboard-digit w-16 bg-courtink-2 border border-white/10 rounded-sm px-2 py-1.5 text-center focus:outline-none focus:border-amber"
              />
              {sets.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeSet(idx)}
                  className="text-slate hover:text-fault text-sm ml-1"
                >
                  remove
                </button>
              )}
            </div>
          ))}
        </div>
        <button type="button" onClick={addSet} className="text-amber text-sm font-semibold mt-2">
          + Add set
        </button>
      </div>

      {error && <p className="text-fault text-sm">{error}</p>}

      <button
        type="submit"
        disabled={saving}
        className="bg-amber text-courtink font-display text-lg tracking-wide px-6 py-2.5 rounded-sm hover:bg-chalk transition-colors disabled:opacity-50"
      >
        {saving ? "Saving…" : "Save game"}
      </button>
    </form>
  );
}
