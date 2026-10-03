import { useEffect, useState } from "react";
import { api } from "../api";
import AdminUsersTab from "../components/AdminUsersTab";
import AdminGroupsTab from "../components/AdminGroupsTab";

const TABS = [
  { id: "users", label: "Users" },
  { id: "groups", label: "Groups" },
];

export default function AdminPage() {
  const [tab, setTab] = useState("users");
  const [users, setUsers] = useState([]);
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [usersError, setUsersError] = useState(null);
  const [groupsError, setGroupsError] = useState(null);

  const load = async () => {
    setUsersError(null);
    setGroupsError(null);
    // Independent, not Promise.all -- one endpoint failing shouldn't blank
    // out data from the other, and we want to know exactly WHICH one broke.
    const [usersResult, groupsResult] = await Promise.allSettled([api.adminListUsers(), api.listGroups()]);

    if (usersResult.status === "fulfilled") setUsers(usersResult.value);
    else setUsersError(`[GET /api/admin/users] ${usersResult.reason.status ?? "?"}: ${usersResult.reason.message}`);

    if (groupsResult.status === "fulfilled") setGroups(groupsResult.value);
    else setGroupsError(`[GET /api/groups] ${groupsResult.reason.status ?? "?"}: ${groupsResult.reason.message}`);

    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 sm:py-10">
      <div className="text-[11px] uppercase tracking-[0.2em] text-slate font-semibold mb-2">Super admin</div>
      <h1 className="font-display text-3xl sm:text-4xl leading-none mb-8">Everything, everywhere</h1>

      {(usersError || groupsError) && (
        <div className="mb-6 rounded-sm border border-fault/40 bg-fault/10 text-fault px-4 py-3 text-sm space-y-1 font-mono">
          {usersError && <div>{usersError}</div>}
          {groupsError && <div>{groupsError}</div>}
        </div>
      )}

      <div className="flex gap-1 border-b border-white/10 mb-8">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-4 py-2.5 text-sm font-semibold border-b-2 -mb-px transition-colors ${
              tab === t.id ? "border-amber text-chalk" : "border-transparent text-slate hover:text-chalk"
            }`}
          >
            {t.label}
            {t.id === "users" && users.length > 0 && (
              <span className="ml-1.5 text-xs text-slate">({users.length})</span>
            )}
            {t.id === "groups" && groups.length > 0 && (
              <span className="ml-1.5 text-xs text-slate">({groups.length})</span>
            )}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="text-slate">Loading…</p>
      ) : tab === "users" ? (
        <AdminUsersTab users={users} onChanged={load} />
      ) : (
        <AdminGroupsTab groups={groups} users={users} onChanged={load} />
      )}
    </div>
  );
}
