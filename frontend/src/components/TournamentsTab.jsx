import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api";

const STATUS_LABEL = { draft: "Draft", in_progress: "In progress", completed: "Completed" };
const STATUS_COLOR = {
  draft: "bg-white/10 text-slate",
  in_progress: "bg-amber/15 text-amber",
  completed: "bg-court/20 text-court-light",
};

export default function TournamentsTab({ groupId, members, isOwner }) {
  const [tournaments, setTournaments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);

  const load = () => {
    setLoading(true);
    api.listTournaments(groupId).then((t) => {
      setTournaments(t);
      setLoading(false);
    });
  };

  useEffect(load, [groupId]);

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <p className="text-slate text-sm">Round-robin tournaments within this group.</p>
        {isOwner && !showCreate && (
          <button
            onClick={() => setShowCreate(true)}
            className="bg-court hover:bg-court-light transition-colors rounded-sm px-4 py-2 text-sm font-semibold"
          >
            + New tournament
          </button>
        )}
      </div>

      {showCreate && (
        <CreateTournamentForm
          groupId={groupId}
          members={members}
          onCreated={() => {
            setShowCreate(false);
            load();
          }}
          onCancel={() => setShowCreate(false)}
        />
      )}

      {loading ? (
        <p className="text-slate text-sm">Loading…</p>
      ) : tournaments.length === 0 ? (
        <p className="text-slate text-sm py-6">No tournaments yet.</p>
      ) : (
        <div className="space-y-3">
          {tournaments.map((t) => (
            <Link
              key={t.id}
              to={`/tournaments/${t.id}`}
              className="flex items-center justify-between gap-3 bg-courtink-2 border border-white/5 hover:border-amber/50 rounded-sm px-5 py-4 transition-colors"
            >
              <div>
                <div className="font-display text-xl">{t.name}</div>
                <div className="text-xs text-slate mt-0.5 capitalize">
                  {t.match_type} · {t.entry_count} entries
                </div>
              </div>
              <span className={`text-[10px] uppercase tracking-wide px-2 py-1 rounded-full shrink-0 ${STATUS_COLOR[t.status]}`}>
                {STATUS_LABEL[t.status]}
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

function CreateTournamentForm({ groupId, members, onCreated, onCancel }) {
  const [name, setName] = useState("");
  const [matchType, setMatchType] = useState("singles");
  const [entries, setEntries] = useState([]); // array of arrays: [id] or [id1, id2]
  const [pairStaging, setPairStaging] = useState([]); // for building doubles pairs
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const usedIds = new Set(entries.flat());

  const handleMatchType = (type) => {
    setMatchType(type);
    setEntries([]);
    setPairStaging([]);
  };

  const toggleMember = (id) => {
    if (matchType === "singles") {
      if (usedIds.has(id)) {
        setEntries((prev) => prev.filter((e) => e[0] !== id));
      } else {
        setEntries((prev) => [...prev, [id]]);
      }
    } else {
      if (usedIds.has(id)) return; // already in a pair
      if (pairStaging.includes(id)) {
        setPairStaging((prev) => prev.filter((x) => x !== id));
      } else if (pairStaging.length < 2) {
        const next = [...pairStaging, id];
        if (next.length === 2) {
          setEntries((prev) => [...prev, next]);
          setPairStaging([]);
        } else {
          setPairStaging(next);
        }
      }
    }
  };

  const removeEntry = (idx) => setEntries((prev) => prev.filter((_, i) => i !== idx));

  const nameFor = (id) => members.find((m) => m.id === id)?.name || "?";

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    if (!name.trim()) return setError("Name is required.");
    if (entries.length < 2) return setError("Add at least 2 entries.");
    setSaving(true);
    try {
      await api.createTournament(groupId, { name: name.trim(), match_type: matchType, entries });
      onCreated();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="bg-courtink-2 border border-white/5 rounded-sm px-5 py-5 mb-6 space-y-5">
      <div>
        <label className="block text-xs uppercase tracking-wide text-slate mb-1">Name</label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Spring Championship"
          className="w-full bg-courtink border border-white/10 rounded-sm px-3 py-2 text-sm focus:outline-none focus:border-amber"
        />
      </div>

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

      <div>
        <div className="text-[11px] uppercase tracking-[0.15em] text-slate font-semibold mb-2">
          {matchType === "singles" ? "Select players" : "Build pairs (click 2 players to pair them)"}
        </div>
        <div className="flex flex-wrap gap-2">
          {members.map((m) => {
            const inEntry = usedIds.has(m.id);
            const staged = pairStaging.includes(m.id);
            return (
              <button
                type="button"
                key={m.id}
                onClick={() => toggleMember(m.id)}
                disabled={inEntry}
                className={`px-3 py-1.5 rounded-full text-sm border transition-colors ${
                  inEntry
                    ? "border-white/5 text-slate/40 cursor-not-allowed"
                    : staged
                    ? "bg-amber/30 border-amber text-chalk"
                    : "border-white/15 text-chalk hover:border-amber/60"
                }`}
              >
                {m.name}
              </button>
            );
          })}
        </div>
      </div>

      {entries.length > 0 && (
        <div>
          <div className="text-[11px] uppercase tracking-[0.15em] text-slate font-semibold mb-2">
            Entries ({entries.length})
          </div>
          <div className="space-y-1.5">
            {entries.map((entry, idx) => (
              <div key={idx} className="flex items-center justify-between text-sm bg-courtink rounded-sm px-3 py-1.5">
                <span>{entry.map(nameFor).join(" & ")}</span>
                <button type="button" onClick={() => removeEntry(idx)} className="text-slate hover:text-fault text-xs">
                  remove
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {error && <p className="text-fault text-sm">{error}</p>}

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={saving}
          className="bg-amber text-courtink font-display text-lg tracking-wide px-6 py-2.5 rounded-sm hover:bg-chalk transition-colors disabled:opacity-50"
        >
          {saving ? "Creating…" : "Create tournament"}
        </button>
        <button type="button" onClick={onCancel} className="text-slate hover:text-chalk text-sm">
          Cancel
        </button>
      </div>
    </form>
  );
}
