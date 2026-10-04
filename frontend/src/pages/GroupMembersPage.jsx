import { useCallback, useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { api } from "../api";
import MembersBar from "../components/MembersBar";

export default function GroupMembersPage() {
  const { groupId } = useParams();
  const [group, setGroup] = useState(null);
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      const [g, m] = await Promise.all([api.getGroup(groupId), api.listMembers(groupId)]);
      setGroup(g);
      setMembers(m);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [groupId]);

  useEffect(() => {
    setLoading(true);
    load();
  }, [load]);

  if (loading) return <div className="max-w-5xl mx-auto px-4 sm:px-6 py-10 text-slate">Loading…</div>;
  if (error || !group) {
    return (
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-10">
        <p className="text-fault text-sm">{error || "Group not found."}</p>
      </div>
    );
  }

  // Same rule the API enforces: owner or admin can add/remove.
  const canManage = group.role === "owner" || group.role === "admin";
  const joined = members.filter((m) => m.has_joined).length;
  const invited = members.length - joined;

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 sm:py-10">
      <Link to={`/groups/${groupId}`} className="inline-block text-sm text-slate hover:text-amber mb-6">
        ← Back to {group.name}
      </Link>

      <div className="text-[11px] uppercase tracking-[0.2em] text-slate font-semibold mb-2">Members</div>
      <h1 className="font-display text-3xl sm:text-4xl leading-none mb-3 break-words">{group.name}</h1>
      <p className="text-slate text-sm mb-8">
        <span className="scoreboard-digit text-chalk">{joined}</span> joined
        {invited > 0 && (
          <>
            {" · "}
            <span className="scoreboard-digit text-amber/90">{invited}</span> invited, waiting to sign up
          </>
        )}
        {canManage ? "" : " · only the group owner can add or remove members"}
      </p>

      <MembersBar
        groupId={groupId}
        members={members}
        canInvite={canManage}
        canRemove={canManage}
        onChange={load}
      />
    </div>
  );
}
