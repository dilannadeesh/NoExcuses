import { useEffect, useState, useCallback } from "react";
import { useParams } from "react-router-dom";
import { api } from "../api";
import ScoreTile from "../components/ScoreTile";
import MembersBar from "../components/MembersBar";
import LogGameForm from "../components/LogGameForm";
import GameHistoryList from "../components/GameHistoryList";
import StandingsView from "../components/StandingsView";

const TABS = [
  { id: "log", label: "Log game" },
  { id: "history", label: "History" },
  { id: "standings", label: "Standings" },
];

export default function GroupDetailPage() {
  const { groupId } = useParams();
  const [group, setGroup] = useState(null);
  const [members, setMembers] = useState([]);
  const [games, setGames] = useState([]);
  const [analytics, setAnalytics] = useState(null);
  const [tab, setTab] = useState("log");
  const [loading, setLoading] = useState(true);

  const loadAll = useCallback(async () => {
    const [g, m, gm, a] = await Promise.all([
      api.getGroup(groupId),
      api.listMembers(groupId),
      api.listGames(groupId),
      api.getAnalytics(groupId),
    ]);
    setGroup(g);
    setMembers(m);
    setGames(gm);
    setAnalytics(a);
    setLoading(false);
  }, [groupId]);

  useEffect(() => {
    setLoading(true);
    loadAll();
  }, [loadAll]);

  if (loading || !group) {
    return <div className="max-w-5xl mx-auto px-6 py-10 text-slate">Loading…</div>;
  }

  const canManage = group.role === "owner" || group.role === "admin";
  const canLog = canManage || group.role === "member";
  const visibleTabs = TABS.filter((t) => t.id !== "log" || canLog);

  return (
    <div className="max-w-5xl mx-auto px-6 py-10">
      <div className="flex items-center gap-3 mb-4">
        <h1 className="font-display text-4xl md:text-5xl leading-none">{group.name}</h1>
        <span className="text-[10px] uppercase tracking-wide bg-court/20 text-court-light px-2 py-1 rounded-full">
          {group.role}
        </span>
      </div>
      <p className="text-slate text-sm mb-6">Owned by {group.owner_name}</p>
      <div className="mb-8">
        <MembersBar groupId={groupId} members={members} canManage={canManage} onChange={loadAll} />
      </div>

      <div className="flex flex-wrap gap-3 mb-10">
        <ScoreTile label="Games logged" value={analytics.totalGames} accent="court" />
        <ScoreTile
          label="Deuce rate"
          value={`${analytics.deucePercentage}%`}
          sub={`${analytics.deuceGames || 0} of ${analytics.totalGames} games`}
          accent="amber"
        />
        <ScoreTile
          label="Best pair"
          value={analytics.bestPair ? `${analytics.bestPair.winPercentage}%` : "—"}
          sub={analytics.bestPair ? analytics.bestPair.names.join(" & ") : "No doubles yet"}
          accent="amber"
        />
      </div>

      <div className="flex gap-1 border-b border-white/10 mb-8">
        {visibleTabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-4 py-2.5 text-sm font-semibold border-b-2 -mb-px transition-colors ${
              tab === t.id ? "border-amber text-chalk" : "border-transparent text-slate hover:text-chalk"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "log" && canLog && <LogGameForm groupId={groupId} members={members} onSaved={loadAll} />}
      {tab === "history" && <GameHistoryList games={games} onChanged={loadAll} canManage={canLog} />}
      {tab === "standings" && <StandingsView analytics={analytics} />}
    </div>
  );
}
