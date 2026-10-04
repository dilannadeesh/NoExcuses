import { useState } from "react";
import { api } from "../api";

function UserRow({ user, onChanged }) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(user.name);
  const [email, setEmail] = useState(user.email);
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const save = async () => {
    setBusy(true);
    setError("");
    try {
      const payload = { name, email };
      if (password.trim()) payload.password = password.trim();
      await api.adminUpdateUser(user.id, payload);
      setPassword("");
      setEditing(false);
      onChanged();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const toggleAdmin = async () => {
    setBusy(true);
    setError("");
    try {
      await api.adminUpdateUser(user.id, { is_admin: !user.is_admin });
      onChanged();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const handleResetPassword = async () => {
    if (!confirm(`Generate a new temporary password for ${user.name}?`)) return;
    setBusy(true);
    setError("");
    try {
      const result = await api.adminUpdateUser(user.id, { reset_password: true });
      alert(`New temporary password for ${user.name}:\n\n${result.generatedPassword}\n\nCopy this now -- it won't be shown again. Share it with them directly.`);
      onChanged();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const toggleActive = async () => {
    const deactivating = user.is_active;
    const msg = deactivating
      ? `Deactivate ${user.name}?\n\nThey'll be logged out immediately and won't be able to log in. Their games, groups and history are kept, and you can reactivate them any time.`
      : `Reactivate ${user.name}? They'll be able to log in again.`;
    if (!confirm(msg)) return;
    setBusy(true);
    setError("");
    try {
      await api.adminUpdateUser(user.id, { is_active: !user.is_active });
      onChanged();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm(`Delete ${user.name}? This can't be undone.`)) return;
    setBusy(true);
    setError("");
    try {
      await api.adminDeleteUser(user.id);
      onChanged();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <tr className={`border-b border-white/5 align-top ${user.is_active ? "" : "opacity-60"}`}>
      <td className="py-3 pr-3">
        {editing ? (
          <div className="space-y-1">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-courtink border border-white/10 rounded-sm px-2 py-1 text-sm focus:outline-none focus:border-amber"
            />
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-courtink border border-white/10 rounded-sm px-2 py-1 text-sm focus:outline-none focus:border-amber"
            />
            <input
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="New password (optional, 8+ chars)"
              className="w-full bg-courtink border border-white/10 rounded-sm px-2 py-1 text-xs focus:outline-none focus:border-amber placeholder:text-slate/60"
            />
          </div>
        ) : (
          <div>
            <div className="text-chalk">{user.name}</div>
            <div className="text-slate text-xs">{user.email}</div>
          </div>
        )}
      </td>
      <td className="py-3 pr-3 text-xs">
        {!user.is_active && (
          <span className="bg-fault/15 text-fault px-1.5 py-0.5 rounded-full mr-1.5">Deactivated</span>
        )}
        {user.has_joined ? (
          <span className="text-court-light">joined</span>
        ) : (
          <span className="text-amber/80">invited</span>
        )}
      </td>
      <td className="py-3 pr-3 text-xs">
        {user.is_admin && (
          <span className="bg-amber/15 text-amber px-1.5 py-0.5 rounded-full">Admin</span>
        )}
      </td>
      <td className="py-3 pr-3 text-xs scoreboard-digit text-slate">
        {user.groups_owned} owned · {user.groups_member_of} in · {user.games_played} games
      </td>
      <td className="py-3 text-right whitespace-nowrap">
        {editing ? (
          <div className="flex justify-end gap-2">
            <button onClick={save} disabled={busy} className="text-amber text-xs font-semibold disabled:opacity-50">
              Save
            </button>
            <button onClick={() => { setEditing(false); setPassword(""); }} className="text-slate text-xs">
              Cancel
            </button>
          </div>
        ) : (
          <div className="flex justify-end gap-3">
            <button onClick={() => setEditing(true)} className="text-slate hover:text-chalk text-xs">
              edit
            </button>
            <button onClick={toggleAdmin} disabled={busy} className="text-slate hover:text-amber text-xs disabled:opacity-50">
              {user.is_admin ? "demote" : "promote"}
            </button>
            <button onClick={handleResetPassword} disabled={busy} className="text-slate hover:text-amber text-xs disabled:opacity-50">
              reset pw
            </button>
            <button onClick={toggleActive} disabled={busy} className="text-slate hover:text-amber text-xs disabled:opacity-50">
              {user.is_active ? "deactivate" : "reactivate"}
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

export default function AdminUsersTab({ users, onChanged }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [creating, setCreating] = useState(false);

  const handleCreate = async (e) => {
    e.preventDefault();
    setError("");
    if (!name.trim() || !email.trim()) return;
    setCreating(true);
    try {
      await api.adminCreateUser(name.trim(), email.trim());
      setName("");
      setEmail("");
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
          <label className="block text-[10px] uppercase tracking-wide text-slate mb-1">Name</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="bg-courtink-2 border border-white/10 rounded-sm px-3 py-2 text-sm focus:outline-none focus:border-amber w-40"
          />
        </div>
        <div>
          <label className="block text-[10px] uppercase tracking-wide text-slate mb-1">Email</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="bg-courtink-2 border border-white/10 rounded-sm px-3 py-2 text-sm focus:outline-none focus:border-amber w-56"
          />
        </div>
        <button
          type="submit"
          disabled={creating}
          className="bg-court hover:bg-court-light transition-colors rounded-sm px-4 py-2 text-sm font-semibold disabled:opacity-50"
        >
          + Create user
        </button>
      </form>
      {error && <p className="text-fault text-sm mb-4">{error}</p>}

      <div className="overflow-x-auto">
        <table className="w-full text-sm min-w-[720px]">
          <thead>
            <tr className="text-left text-slate text-xs uppercase tracking-wide court-line">
              <th className="py-2 font-medium">User</th>
              <th className="py-2 font-medium">Status</th>
              <th className="py-2 font-medium">Role</th>
              <th className="py-2 font-medium">Activity</th>
              <th className="py-2 font-medium text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <UserRow key={u.id} user={u} onChanged={onChanged} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
