import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Flag, LogOut } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import ConfirmSheet from "../components/ConfirmSheet";
import ReportSheet from "../components/ReportSheet";
import { api } from "../api";
import MembersBar from "../components/MembersBar";
import Screen from "../components/Screen";
import { LoadingBlock, ErrorNote } from "../components/States";

export default function GroupMembersPage() {
  const { groupId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [group, setGroup] = useState(null);
  const [reporting, setReporting] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [leaveBusy, setLeaveBusy] = useState(false);
  const [leaveError, setLeaveError] = useState("");
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

  const leave = async () => {
    setLeaveBusy(true);
    setLeaveError("");
    try {
      await api.removeMember(groupId, user.id);
      navigate("/", { replace: true });
    } catch (e) {
      setLeaveError(e.message);
      setLeaveBusy(false);
    }
  };

  const isMember = members.some((m) => m.id === user?.id);
  const ownsIt = group.owner_id === user?.id;

  // Same rule the API enforces: owner or admin can add/remove.
  const canManage = group.role === "owner" || group.role === "admin";
  const joined = members.filter((m) => m.has_joined).length;
  const invited = members.length - joined;

  return (
    <Screen>
      <h1 className="px-1 display text-[32px]">{group.name}</h1>
      <p className="mb-5 mt-1 px-1 text-sm text-muted">Everyone who plays in this group</p>

      <div className="mb-5 grid grid-cols-2 gap-3">
        <div className="card p-4">
          <p className="num text-2xl font-semibold leading-none">{joined}</p>
          <p className="mt-2 text-xs font-medium text-muted">Joined</p>
        </div>
        <div className="card p-4">
          <p className="num text-2xl font-semibold leading-none">{invited}</p>
          <p className="mt-2 text-xs font-medium text-muted">Invited, not signed up</p>
        </div>
      </div>

      <MembersBar
        groupId={groupId}
        members={members}
        canInvite={canManage}
        canRemove={canManage}
        onChange={load}
        ownerId={group.owner_id}
        currentUserId={user?.id}
      />

      {/* Safety: anyone can report a problem to the team, and anyone but the owner can leave. */}
      <section className="mt-8 space-y-2.5">
        <button type="button" onClick={() => setReporting(true)} className="btn-secondary w-full">
          <Flag size={17} aria-hidden /> Report a problem
        </button>
        {isMember && !ownsIt && (
          <button type="button" onClick={() => setLeaving(true)} className="btn h-12 w-full text-[15px] text-loss hover:bg-loss-soft">
            <LogOut size={17} aria-hidden /> Leave this group
          </button>
        )}
        <p className="px-1 text-center text-xs text-faint">
          Reports go to the NoExcuses team, not the group. We review them within 24 hours.
        </p>
      </section>

      {reporting && (
        <ReportSheet
          groupId={groupId}
          groupName={group.name}
          members={members}
          currentUserId={user?.id}
          onClose={() => setReporting(false)}
        />
      )}
      {leaving && (
        <ConfirmSheet
          title={`Leave ${group.name}?`}
          confirmLabel="Leave group"
          busyLabel="Leaving…"
          busy={leaveBusy}
          error={leaveError}
          onConfirm={leave}
          onCancel={() => setLeaving(false)}
        >
          You’ll stop seeing this group. Games you played stay in its history, and anything you owe or are owed
          stays on record. The owner can add you back later.
        </ConfirmSheet>
      )}
    </Screen>
  );
}
