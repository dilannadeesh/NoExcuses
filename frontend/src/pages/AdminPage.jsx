import { useEffect, useState } from "react";
import { api } from "../api";
import AdminUsersTab from "../components/AdminUsersTab";
import AdminGroupsTab from "../components/AdminGroupsTab";
import Screen from "../components/Screen";
import { LoadingBlock } from "../components/States";

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
    <Screen wide bottom="nav">
      <p className="mb-5 px-1 text-[15px] text-muted">Manage every user and group in the app.</p>

      <div className="mb-5 grid grid-cols-2 gap-3">
        <div className="card p-4">
          <p className="num text-2xl font-semibold leading-none">{users.length}</p>
          <p className="mt-2 text-xs font-medium text-muted">Users</p>
        </div>
        <div className="card p-4">
          <p className="num text-2xl font-semibold leading-none">{groups.length}</p>
          <p className="mt-2 text-xs font-medium text-muted">Groups</p>
        </div>
      </div>

      {(usersError || groupsError) && (
        <div role="alert" className="mb-5 space-y-1 rounded-xl bg-loss-soft px-4 py-3 font-mono text-xs font-medium text-loss">
          {usersError && <div>{usersError}</div>}
          {groupsError && <div>{groupsError}</div>}
        </div>
      )}

      <div className="seg mb-4" role="tablist">
        {TABS.map((t) => (
          <button
            key={t.id}
            role="tab"
            aria-selected={tab === t.id}
            onClick={() => setTab(t.id)}
            className={`seg-item ${tab === t.id ? "seg-item-active" : ""}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {loading ? (
        <LoadingBlock rows={3} />
      ) : tab === "users" ? (
        <AdminUsersTab users={users} onChanged={load} />
      ) : (
        <AdminGroupsTab groups={groups} users={users} onChanged={load} />
      )}
    </Screen>
  );
}
