import { useState } from "react";
import { Link } from "react-router-dom";
import { Plus } from "lucide-react";
import { api } from "../api";
import Avatar from "./Avatar";
import { ErrorNote } from "./States";

const act = "btn h-9 bg-soft px-3.5 text-[13px] text-ink hover:bg-line/70";

function GroupRow({ group, users, onChanged }) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(group.name);
  const [ownerId, setOwnerId] = useState(group.owner_id);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const save = async () => {
    setBusy(true);
    setError("");
    try {
      const payload = {};
      if (name !== group.name) payload.name = name;
      if (Number(ownerId) !== group.owner_id) payload.owner_id = Number(ownerId);
      if (Object.keys(payload).length > 0) await api.adminUpdateGroup(group.id, payload);
      setEditing(false);
      onChanged();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm(`Delete "${group.name}"? All its games and history go with it. This can't be undone.`)) return;
    setBusy(true);
    setError("");
    try {
      await api.deleteGroup(group.id);
      onChanged();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <li className="card p-4">
      <div className="flex items-center gap-3">
        <Avatar name={group.name} size={46} shape="tile" />
        <div className="min-w-0 flex-1">
          <Link to={`/groups/${group.id}`} className="block truncate font-bold hover:underline">
            {group.name}
          </Link>
          <p className="truncate text-xs text-muted">Owner: {group.owner_name}</p>
        </div>
      </div>
      <p className="num mt-3 text-xs text-muted">
        {group.member_count} members · {group.game_count} games
      </p>

      {editing ? (
        <div className="mt-4 space-y-3 border-t border-line pt-4">
          <div>
            <label className="label">Group name</label>
            <input value={name} onChange={(e) => setName(e.target.value)} className="input" />
          </div>
          <div>
            <label className="label">Owner</label>
            <select value={ownerId} onChange={(e) => setOwnerId(e.target.value)} className="input">
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </select>
          </div>
          <div className="flex gap-2">
            <button onClick={save} disabled={busy} className="btn h-11 flex-1 bg-ink px-5 text-sm text-white">
              Save
            </button>
            <button onClick={() => setEditing(false)} className="btn-secondary !h-11">
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <div className="mt-4 flex flex-wrap gap-2 border-t border-line pt-4">
          <button onClick={() => setEditing(true)} className={act}>Edit</button>
          <button onClick={handleDelete} disabled={busy} className="btn-danger">Delete</button>
        </div>
      )}
      <ErrorNote className="mt-3">{error}</ErrorNote>
    </li>
  );
}

export default function AdminGroupsTab({ groups, users, onChanged }) {
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [ownerId, setOwnerId] = useState(users[0]?.id || "");
  const [error, setError] = useState("");
  const [creating, setCreating] = useState(false);

  const handleCreate = async (e) => {
    e.preventDefault();
    setError("");
    if (!name.trim() || !ownerId) return;
    setCreating(true);
    try {
      await api.adminCreateGroup(name.trim(), Number(ownerId));
      setName("");
      setShowForm(false);
      onChanged();
    } catch (err) {
      setError(err.message);
    } finally {
      setCreating(false);
    }
  };

  return (
    <div>
      {!showForm ? (
        <button onClick={() => setShowForm(true)} className="btn-primary mb-4 w-full">
          Create group <Plus size={18} />
        </button>
      ) : (
        <form onSubmit={handleCreate} className="card mb-4 space-y-3 p-4">
          <div>
            <label htmlFor="ag-name" className="label">Group name</label>
            <input id="ag-name" value={name} onChange={(e) => setName(e.target.value)} className="input" autoFocus />
          </div>
          <div>
            <label htmlFor="ag-owner" className="label">Owner</label>
            <select id="ag-owner" value={ownerId} onChange={(e) => setOwnerId(e.target.value)} className="input">
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </select>
          </div>
          <ErrorNote>{error}</ErrorNote>
          <div className="flex gap-2">
            <button type="submit" disabled={creating} className="btn-primary flex-1">
              {creating ? "Creating…" : "Create group"}
            </button>
            <button type="button" onClick={() => setShowForm(false)} className="btn-secondary !h-14">
              Cancel
            </button>
          </div>
        </form>
      )}

      <ul className="space-y-3">
        {groups.map((g) => (
          <GroupRow key={g.id} group={g} users={users} onChanged={onChanged} />
        ))}
      </ul>
    </div>
  );
}
