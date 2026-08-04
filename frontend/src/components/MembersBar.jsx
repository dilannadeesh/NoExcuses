import { useState } from "react";
import { api } from "../api";

export default function MembersBar({ groupId, members, canManage, onChange }) {
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
      onChange();
    } catch (err) {
      setError(err.message);
    } finally {
      setAdding(false);
    }
  };

  const handleRemove = async (memberId) => {
    await api.removeMember(groupId, memberId);
    onChange();
  };

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        {members.map((m) => (
          <span
            key={m.id}
            title={m.email}
            className="group inline-flex items-center gap-2 bg-courtink-2 border border-white/10 rounded-full pl-3 pr-1 py-1 text-sm"
          >
            {m.name}
            {!m.has_joined && (
              <span className="text-[10px] uppercase tracking-wide text-amber/80">invited</span>
            )}
            {canManage && (
              <button
                onClick={() => handleRemove(m.id)}
                title="Remove from group"
                className="w-5 h-5 rounded-full flex items-center justify-center text-slate hover:bg-fault/20 hover:text-fault transition-colors"
              >
                ×
              </button>
            )}
          </span>
        ))}
      </div>
      {canManage && (
        <form onSubmit={handleAdd} className="flex flex-wrap items-center gap-2 mt-3">
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Name"
            className="bg-transparent border border-dashed border-white/20 rounded-full px-3 py-1 text-sm placeholder:text-slate/60 focus:outline-none focus:border-amber w-28"
          />
          <input
            type="email"
            value={newEmail}
            onChange={(e) => setNewEmail(e.target.value)}
            placeholder="Email"
            className="bg-transparent border border-dashed border-white/20 rounded-full px-3 py-1 text-sm placeholder:text-slate/60 focus:outline-none focus:border-amber w-44"
          />
          <button type="submit" disabled={adding} className="text-amber text-sm font-semibold px-1 disabled:opacity-50">
            + Add
          </button>
        </form>
      )}
      {error && <p className="text-fault text-xs mt-1">{error}</p>}
    </div>
  );
}
