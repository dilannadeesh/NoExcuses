import { useCallback, useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { api } from "../api";
import MembersBar from "../components/MembersBar";
import Screen from "../components/Screen";
import { LoadingBlock, ErrorNote } from "../components/States";

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

  if (loading) return <Screen><LoadingBlock rows={4} /></Screen>;
  if (error || !group) {
    return (
      <Screen>
        <ErrorNote>{error || "Group not found."}</ErrorNote>
      </Screen>
    );
  }

  // Same rule the API enforces: owner or admin can add/remove.
  const canManage = group.role === "owner" || group.role === "admin";
  const joined = members.filter((m) => m.has_joined).length;
  const invited = members.length - joined;

  return (
    <Screen>
      <h1 className="px-1 text-2xl font-extrabold leading-tight tracking-tight">{group.name}</h1>
      <p className="mb-5 mt-1 px-1 text-sm text-muted">Everyone who plays in this group</p>

      <div className="mb-5 grid grid-cols-2 gap-3">
        <div className="rounded-3xl bg-win-soft p-4">
          <p className="num text-3xl font-extrabold leading-none text-win">{joined}</p>
          <p className="mt-1.5 text-xs font-semibold text-win/80">Joined</p>
        </div>
        <div className="rounded-3xl bg-warn-soft p-4">
          <p className="num text-3xl font-extrabold leading-none text-warn">{invited}</p>
          <p className="mt-1.5 text-xs font-semibold text-warn/80">Invited, not signed up</p>
        </div>
      </div>

      <MembersBar groupId={groupId} members={members} canInvite={canManage} canRemove={canManage} onChange={load} />
    </Screen>
  );
}
