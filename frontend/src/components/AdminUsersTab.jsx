import { useState } from "react";
import { Plus } from "lucide-react";
import { api } from "../api";
import Avatar from "./Avatar";
import { ErrorNote } from "./States";

const act = "btn h-9 bg-soft px-3.5 text-[13px] text-ink hover:bg-line/70";

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
    <li className={`card p-4 ${user.is_active ? "" : "opacity-70"}`}>
      <div className="flex items-center gap-3">
        <Avatar name={user.name} size={44} />
        <div className="min-w-0 flex-1">
          <p className="truncate font-bold">{user.name}</p>
          <p className="truncate text-xs text-muted">{user.email}</p>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        {user.is_admin && <span className="chip bg-brand-soft text-brand">Admin</span>}
        {!user.is_active && <span className="chip bg-loss-soft text-loss">Deactivated</span>}
        {!user.has_joined && <span className="chip bg-warn-soft text-warn">Invited</span>}
        <span className="num text-xs text-muted">
          {user.groups_owned} owned · {user.groups_member_of} groups · {user.games_played} games
        </span>
      </div>

      {editing ? (
        <div className="mt-4 space-y-3 border-t border-line pt-4">
          <div>
            <label className="label">Name</label>
            <input value={name} onChange={(e) => setName(e.target.value)} className="input" />
          </div>
          <div>
            <label className="label">Email</label>
            <input value={email} onChange={(e) => setEmail(e.target.value)} className="input" />
          </div>
          <div>
            <label className="label">New password (optional)</label>
            <input
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="8+ characters"
              className="input"
            />
          </div>
          <div className="flex gap-2">
            <button onClick={save} disabled={busy} className="btn h-11 flex-1 bg-ink px-5 text-sm text-white">
              Save
            </button>
            <button
              onClick={() => {
                setEditing(false);
                setPassword("");
              }}
              className="btn-secondary !h-11"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <div className="mt-4 flex flex-wrap gap-2 border-t border-line pt-4">
          <button onClick={() => setEditing(true)} className={act}>Edit</button>
          <button onClick={toggleAdmin} disabled={busy} className={act}>
            {user.is_admin ? "Demote" : "Promote"}
          </button>
          <button onClick={handleResetPassword} disabled={busy} className={act}>Reset password</button>
          <button onClick={toggleActive} disabled={busy} className={act}>
            {user.is_active ? "Deactivate" : "Reactivate"}
          </button>
          <button onClick={handleDelete} disabled={busy} className="btn-danger">Delete</button>
        </div>
      )}
      <ErrorNote className="mt-3">{error}</ErrorNote>
    </li>
  );
}

export default function AdminUsersTab({ users, onChanged }) {
  const [showForm, setShowForm] = useState(false);
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
          Create user <Plus size={18} />
        </button>
      ) : (
        <form onSubmit={handleCreate} className="card mb-4 space-y-3 p-4">
          <div>
            <label htmlFor="au-name" className="label">Name</label>
            <input id="au-name" value={name} onChange={(e) => setName(e.target.value)} className="input" autoFocus />
          </div>
          <div>
            <label htmlFor="au-email" className="label">Email</label>
            <input id="au-email" type="email" inputMode="email" value={email} onChange={(e) => setEmail(e.target.value)} className="input" />
          </div>
          <ErrorNote>{error}</ErrorNote>
          <div className="flex gap-2">
            <button type="submit" disabled={creating} className="btn-primary flex-1">
              {creating ? "Creating…" : "Create user"}
            </button>
            <button type="button" onClick={() => setShowForm(false)} className="btn-secondary !h-14">
              Cancel
            </button>
          </div>
        </form>
      )}

      <ul className="space-y-3">
        {users.map((u) => (
          <UserRow key={u.id} user={u} onChanged={onChanged} />
        ))}
      </ul>
    </div>
  );
}
