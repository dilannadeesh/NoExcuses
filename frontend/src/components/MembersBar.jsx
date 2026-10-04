import { useState } from "react";
import { Plus, X } from "lucide-react";
import { api } from "../api";
import Avatar from "./Avatar";
import { ErrorNote } from "./States";

export default function MembersBar({ groupId, members, canInvite, canRemove, onChange }) {
  const [showForm, setShowForm] = useState(false);
  const [newName, setNewName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState("");

  const handleAdd = async (e) => {
    e.preventDefault();
    if (!newName.trim() || !newEmail.trim()) return;
    setAdding(true);
    setError("");
    try {
      await api.addMember(groupId, newName.trim(), newEmail.trim());
      setNewName("");
      setNewEmail("");
      setShowForm(false);
      onChange();
    } catch (err) {
      setError(err.message);
    } finally {
      setAdding(false);
    }
  };

  const handleRemove = async (member) => {
    if (!confirm(`Remove ${member.name} from this group?`)) return;
    await api.removeMember(groupId, member.id);
    onChange();
  };

  return (
    <div className="space-y-4">
      {canInvite && (
        <>
          {!showForm ? (
            <button onClick={() => setShowForm(true)} className="btn-primary w-full">
              Add member <Plus size={18} />
            </button>
          ) : (
            <form onSubmit={handleAdd} className="card space-y-3 p-4">
              <div>
                <label htmlFor="member-name" className="label">Name</label>
                <input id="member-name" value={newName} onChange={(e) => setNewName(e.target.value)} className="input" autoFocus />
              </div>
              <div>
                <label htmlFor="member-email" className="label">Email</label>
                <input
                  id="member-email"
                  type="email"
                  inputMode="email"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  className="input"
                />
                <p className="mt-1.5 text-xs text-faint">
                  They don’t need an account yet — signing up with this email links them here.
                </p>
              </div>
              <ErrorNote>{error}</ErrorNote>
              <div className="flex gap-2">
                <button type="submit" disabled={adding} className="btn-primary flex-1">
                  {adding ? "Adding…" : "Add member"}
                </button>
                <button type="button" onClick={() => setShowForm(false)} className="btn-secondary">
                  Cancel
                </button>
              </div>
            </form>
          )}
        </>
      )}

      <ul className="card divide-y divide-line px-2 py-1">
        {members.map((m) => (
          <li key={m.id} title={m.email} className="flex items-center gap-3 px-2 py-3">
            <Avatar name={m.name} size={42} />
            <div className="min-w-0 flex-1">
              <p className="truncate font-semibold">{m.name}</p>
              {!m.has_joined && <p className="text-xs text-muted">Hasn’t signed up yet</p>}
            </div>
            {!m.has_joined && <span className="chip bg-warn-soft text-warn">Invited</span>}
            {canRemove && (
              <button
                onClick={() => handleRemove(m)}
                aria-label={`Remove ${m.name}`}
                className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-soft text-muted transition hover:bg-loss-soft hover:text-loss active:scale-95"
              >
                <X size={16} />
              </button>
            )}
          </li>
        ))}
      </ul>
      {!canInvite && (
        <p className="px-1 text-center text-xs text-faint">Only the group owner can add or remove members.</p>
      )}
    </div>
  );
}
