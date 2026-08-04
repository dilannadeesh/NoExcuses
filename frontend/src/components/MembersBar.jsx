import { useState } from "react";
import { api } from "../api";

export default function MembersBar({ groupId, members, onChange }) {
  const [newName, setNewName] = useState("");
  const [adding, setAdding] = useState(false);

  const handleAdd = async (e) => {
    e.preventDefault();
    if (!newName.trim()) return;
    setAdding(true);
    try {
      await api.addMember(groupId, newName.trim());
      setNewName("");
      onChange();
    } finally {
      setAdding(false);
    }
  };

  const handleRemove = async (playerId) => {
    await api.removeMember(groupId, playerId);
    onChange();
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      {members.map((m) => (
        <span
          key={m.id}
          className="group inline-flex items-center gap-2 bg-courtink-2 border border-white/10 rounded-full pl-3 pr-1 py-1 text-sm"
        >
          {m.name}
          <button
            onClick={() => handleRemove(m.id)}
            title="Remove from group"
            className="w-5 h-5 rounded-full flex items-center justify-center text-slate hover:bg-fault/20 hover:text-fault transition-colors"
          >
            ×
          </button>
        </span>
      ))}
      <form onSubmit={handleAdd} className="flex items-center gap-1">
        <input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="Add player"
          className="bg-transparent border border-dashed border-white/20 rounded-full px-3 py-1 text-sm placeholder:text-slate/60 focus:outline-none focus:border-amber w-28"
        />
        <button
          type="submit"
          disabled={adding}
          className="text-amber text-sm font-semibold px-1 disabled:opacity-50"
        >
          +
        </button>
      </form>
    </div>
  );
}
