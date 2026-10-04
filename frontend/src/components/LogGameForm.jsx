import { useState } from "react";
import { Check, Plus, X } from "lucide-react";
import { api } from "../api";
import Avatar from "./Avatar";
import { ErrorNote } from "./States";

const emptySet = () => ({ side1_score: "", side2_score: "" });

export default function LogGameForm({ groupId, members, onSaved, editingGame, onCancelEdit }) {
  const isEditing = Boolean(editingGame);

  const [matchType, setMatchType] = useState(editingGame?.match_type || "doubles");
  const [playedAt, setPlayedAt] = useState(
    editingGame ? String(editingGame.played_at).slice(0, 10) : new Date().toISOString().slice(0, 10)
  );
  const [side1, setSide1] = useState(editingGame?.side1.map((p) => p.id) || []);
  const [side2, setSide2] = useState(editingGame?.side2.map((p) => p.id) || []);
  const [sets, setSets] = useState(
    editingGame?.sets.length
      ? editingGame.sets.map((s) => ({ side1_score: String(s.side1_score), side2_score: String(s.side2_score) }))
      : [emptySet()]
  );
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
    setSets([emptySet()]);
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
      if (isEditing) {
        await api.updateGame(editingGame.id, { match_type: matchType, played_at: playedAt, side1, side2, sets: parsedSets });
      } else {
        await api.createGame(groupId, { match_type: matchType, played_at: playedAt, side1, side2, sets: parsedSets });
        reset();
      }
      onSaved();
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  if (members.length < 2) {
    return (
      <div className="card px-6 py-10 text-center">
        <p className="font-semibold">Not enough players yet</p>
        <p className="mt-1 text-sm text-muted">Add at least 2 players to this group before logging a game.</p>
      </div>
    );
  }

  const renderSide = (side) => {
    const selected = side === 1 ? side1 : side2;
    const other = side === 1 ? side2 : side1;
    return (
      <section className="card p-4">
        <div className="mb-3 flex items-center justify-between px-1">
          <h2 className="section-title">Side {side}</h2>
          <span className="chip num">
            {selected.length}/{slotsPerSide}
          </span>
        </div>
        <div className="flex flex-wrap gap-2">
          {members.map((m) => {
            const isSelected = selected.includes(m.id);
            const takenByOtherSide = other.includes(m.id);
            return (
              <button
                type="button"
                key={m.id}
                disabled={takenByOtherSide}
                aria-pressed={isSelected}
                onClick={() => toggleSelect(side, m.id)}
                className={`inline-flex items-center gap-2 rounded-full py-1.5 pl-1.5 pr-3.5 text-sm font-semibold transition active:scale-95 disabled:pointer-events-none ${
                  isSelected
                    ? "bg-ink text-white"
                    : takenByOtherSide
                    ? "bg-soft text-faint opacity-50"
                    : "bg-soft text-ink hover:bg-line/70"
                }`}
              >
                {isSelected ? (
                  <span className="grid h-7 w-7 place-items-center rounded-full bg-white/20">
                    <Check size={15} strokeWidth={3} />
                  </span>
                ) : (
                  <Avatar name={m.name} size={28} />
                )}
                {m.name}
              </button>
            );
          })}
        </div>
      </section>
    );
  };

  const scoreInput = "input num !h-16 text-center text-2xl font-extrabold";

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {isEditing && (
        <p className="rounded-2xl bg-brand-soft px-4 py-3 text-sm font-semibold text-brand">
          Editing the game from {playedAt}
        </p>
      )}

      <div className="seg" role="tablist" aria-label="Match type">
        {["singles", "doubles"].map((t) => (
          <button
            type="button"
            key={t}
            role="tab"
            aria-selected={matchType === t}
            onClick={() => handleMatchType(t)}
            className={`seg-item capitalize ${matchType === t ? "seg-item-active" : ""}`}
          >
            {t}
          </button>
        ))}
      </div>

      <div className="card p-4">
        <label htmlFor="played-at" className="label">Date played</label>
        <input id="played-at" type="date" value={playedAt} onChange={(e) => setPlayedAt(e.target.value)} className="input" />
      </div>

      {renderSide(1)}
      <div className="flex items-center gap-3 px-2" aria-hidden="true">
        <span className="h-px flex-1 bg-line" />
        <span className="text-xs font-extrabold tracking-widest text-faint">VS</span>
        <span className="h-px flex-1 bg-line" />
      </div>
      {renderSide(2)}

      <section className="card p-4">
        <h2 className="section-title mb-3 px-1">Set scores</h2>
        <div className="space-y-3">
          {sets.map((s, idx) => (
            <div key={idx} className="flex items-center gap-2.5">
              <span className="w-9 shrink-0 text-xs font-semibold text-muted">Set {idx + 1}</span>
              <input
                type="number"
                inputMode="numeric"
                min="0"
                aria-label={`Set ${idx + 1}, side 1 score`}
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
                aria-label={`Set ${idx + 1}, side 2 score`}
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
                  className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-soft text-muted transition hover:bg-loss-soft hover:text-loss active:scale-95"
                >
                  <X size={16} />
                </button>
              )}
            </div>
          ))}
        </div>
        <button type="button" onClick={addSet} className="btn mt-4 h-10 bg-soft px-4 text-sm text-ink hover:bg-line/70">
          <Plus size={16} strokeWidth={2.6} /> Add set
        </button>
      </section>

      <ErrorNote>{error}</ErrorNote>

      {/* The primary action stays pinned, however long the player list gets. */}
      <div className="pointer-events-none fixed inset-x-0 bottom-0 z-30 flex justify-center px-5 pb-[max(1rem,env(safe-area-inset-bottom))]">
        <div className="pointer-events-auto flex w-full max-w-md gap-2 md:max-w-xl">
          {isEditing && (
            <button type="button" onClick={onCancelEdit} className="btn-secondary !h-14 shrink-0 shadow-float">
              Cancel
            </button>
          )}
          <button type="submit" disabled={saving} className="btn-primary flex-1 shadow-float">
            {saving ? "Saving…" : isEditing ? "Save changes" : "Save game"}
          </button>
        </div>
      </div>
    </form>
  );
}
