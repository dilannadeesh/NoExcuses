import { useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api";

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
    <tr className="border-b border-white/5 align-top">
      <td className="py-3 pr-3">
        {editing ? (
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full bg-courtink border border-white/10 rounded-sm px-2 py-1 text-sm focus:outline-none focus:border-amber"
          />
        ) : (
          <Link to={`/groups/${group.id}`} className="text-chalk hover:text-amber">
            {group.name}
          </Link>
        )}
      </td>
      <td className="py-3 pr-3 text-xs">
        {editing ? (
          <select
            value={ownerId}
            onChange={(e) => setOwnerId(e.target.value)}
            className="bg-courtink border border-white/10 rounded-sm px-2 py-1 text-xs focus:outline-none focus:border-amber"
          >
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
              </option>
            ))}
          </select>
        ) : (
          <span className="text-slate">{group.owner_name}</span>
        )}
      </td>
      <td className="py-3 pr-3 text-xs scoreboard-digit text-slate">
        {group.member_count} members · {group.game_count} games
      </td>
      <td className="py-3 text-right whitespace-nowrap">
        {editing ? (
          <div className="flex justify-end gap-2">
            <button onClick={save} disabled={busy} className="text-amber text-xs font-semibold disabled:opacity-50">
              Save
            </button>
            <button onClick={() => setEditing(false)} className="text-slate text-xs">
              Cancel
            </button>
          </div>
        ) : (
          <div className="flex justify-end gap-3">
            <button onClick={() => setEditing(true)} className="text-slate hover:text-chalk text-xs">
              edit
            </button>
            <button onClick={handleDelete} disabled={busy} className="text-slate hover:text-fault text-xs disabled:opacity-50">
              delete
            </button>
          </div>
        )}
        {error && <p className="text-fault text-xs mt-1 max-w-[220px] text-right ml-auto">{error}</p>}
      </td>
    </tr>
  );
}

export default function AdminGroupsTab({ groups, users, onChanged }) {
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
      onChanged();
    } catch (err) {
      setError(err.message);
    } finally {
      setCreating(false);
    }
  };

  return (
    <div>
      <form onSubmit={handleCreate} className="flex flex-wrap items-end gap-2 mb-6">
        <div>
          <label className="block text-[10px] uppercase tracking-wide text-slate mb-1">Group name</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="bg-courtink-2 border border-white/10 rounded-sm px-3 py-2 text-sm focus:outline-none focus:border-amber w-48"
          />
        </div>
        <div>
          <label className="block text-[10px] uppercase tracking-wide text-slate mb-1">Owner</label>
          <select
            value={ownerId}
            onChange={(e) => setOwnerId(e.target.value)}
            className="bg-courtink-2 border border-white/10 rounded-sm px-3 py-2 text-sm focus:outline-none focus:border-amber"
          >
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
              </option>
            ))}
          </select>
        </div>
        <button
          type="submit"
          disabled={creating}
          className="bg-court hover:bg-court-light transition-colors rounded-sm px-4 py-2 text-sm font-semibold disabled:opacity-50"
        >
          + Create group
        </button>
      </form>
      {error && <p className="text-fault text-sm mb-4">{error}</p>}

      <div className="overflow-x-auto">
        <table className="w-full text-sm min-w-[600px]">
          <thead>
            <tr className="text-left text-slate text-xs uppercase tracking-wide court-line">
              <th className="py-2 font-medium">Group</th>
              <th className="py-2 font-medium">Owner</th>
              <th className="py-2 font-medium">Activity</th>
              <th className="py-2 font-medium text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {groups.map((g) => (
              <GroupRow key={g.id} group={g} users={users} onChanged={onChanged} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
