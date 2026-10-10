import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Check, ChevronRight, Plus, Trophy, X } from "lucide-react";
import { api } from "../api";
import Avatar from "./Avatar";
import { StatusChip } from "./TournamentView";
import { LoadingBlock, ErrorNote } from "./States";

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
      <div className="mb-4 flex items-center justify-between gap-3 px-1">
        <p className="text-sm text-muted">Round-robin tournaments in this group</p>
        {isOwner && !showCreate && (
          <button onClick={() => setShowCreate(true)} className="btn h-10 shrink-0 bg-lime px-4 text-sm text-onlime">
            New <Plus size={16} strokeWidth={2.6} />
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
        <LoadingBlock rows={2} />
      ) : tournaments.length === 0 ? (
        <div className="card px-6 py-10 text-center">
          <p className="font-semibold">No tournaments yet</p>
          <p className="mt-1 text-sm text-muted">
            {isOwner ? "Create one to get automatic fixtures and a shareable results page." : "The group owner can create one."}
          </p>
        </div>
      ) : (
        <ul className="space-y-3">
          {tournaments.map((t) => (
            <li key={t.id}>
              <Link to={`/tournaments/${t.id}`} className="card flex items-center gap-4 p-4 transition active:scale-[0.99]">
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-soft text-ink">
                  <Trophy size={20} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="line-clamp-2 break-words font-semibold leading-snug">{t.name}</p>
                  <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1">
                    <StatusChip status={t.status} />
                    <span className="text-xs text-muted">
                      <span className="capitalize">{t.match_type}</span> · {t.entry_count} entries
                    </span>
                  </div>
                </div>
                <ChevronRight size={18} className="shrink-0 text-faint" />
              </Link>
            </li>
          ))}
        </ul>
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
    <form onSubmit={handleSubmit} className="card mb-5 space-y-5 p-4">
      <div>
        <label htmlFor="t-name" className="label">Tournament name</label>
        <input id="t-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Spring Championship" className="input" />
      </div>

      <div className="seg !shadow-none bg-soft" role="tablist" aria-label="Match type">
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

      <div>
        <p className="label">{matchType === "singles" ? "Select players" : "Build pairs — tap two players to pair them"}</p>
        <div className="flex flex-wrap gap-2">
          {members.map((m) => {
            const inEntry = usedIds.has(m.id);
            const staged = pairStaging.includes(m.id);
            return (
              <button
                type="button"
                key={m.id}
                onClick={() => toggleMember(m.id)}
                disabled={inEntry && matchType === "doubles"}
                aria-pressed={inEntry || staged}
                className={`inline-flex items-center gap-2 rounded-lg py-1.5 pl-1.5 pr-3 text-sm font-medium transition active:scale-95 disabled:pointer-events-none ${
                  inEntry
                    ? matchType === "doubles"
                      ? "bg-soft text-faint opacity-50"
                      : "bg-lime text-onlime"
                    : staged
                    ? "bg-brand-soft text-brand ring-2 ring-brand"
                    : "bg-soft text-ink hover:bg-line/70"
                }`}
              >
                {inEntry && matchType === "singles" ? (
                  <span className="grid h-7 w-7 place-items-center rounded-md bg-black/15">
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
      </div>

      {entries.length > 0 && (
        <div>
          <p className="label">Entries ({entries.length})</p>
          <ul className="space-y-2">
            {entries.map((entry, idx) => (
              <li key={idx} className="flex items-center gap-3 rounded-xl bg-soft px-3 py-2">
                <span className="flex shrink-0 -space-x-2">
                  {entry.map((id) => (
                    <Avatar key={id} name={nameFor(id)} size={28} className="ring-2 ring-surface" />
                  ))}
                </span>
                <span className="min-w-0 flex-1 truncate text-sm font-semibold">{entry.map(nameFor).join(" & ")}</span>
                <button
                  type="button"
                  onClick={() => removeEntry(idx)}
                  aria-label="Remove entry"
                  className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-surface text-muted hover:bg-loss-soft hover:text-loss"
                >
                  <X size={15} />
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      <ErrorNote>{error}</ErrorNote>

      <div className="flex gap-2">
        <button type="submit" disabled={saving} className="btn-primary flex-1">
          {saving ? "Creating…" : "Create tournament"}
        </button>
        <button type="button" onClick={onCancel} className="btn-secondary !h-12">
          Cancel
        </button>
      </div>
    </form>
  );
}
