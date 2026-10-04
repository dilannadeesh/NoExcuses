import { useEffect, useState, useCallback } from "react";
import { useParams, Link } from "react-router-dom";
import { api } from "../api";
import TopPlayersTile from "../components/TopPlayersTile";
import TopPairsTile from "../components/TopPairsTile";
import LogGameForm from "../components/LogGameForm";
import GameHistoryList from "../components/GameHistoryList";
import StandingsView from "../components/StandingsView";
import TournamentsTab from "../components/TournamentsTab";

const TABS = [
  { id: "log", label: "Log game" },
  { id: "history", label: "History" },
  { id: "standings", label: "Standings" },
  { id: "tournaments", label: "Tournaments" },
];

export default function GroupDetailPage() {
  const { groupId } = useParams();
  const [group, setGroup] = useState(null);
  const [members, setMembers] = useState([]);
  const [games, setGames] = useState([]);
  const [analytics, setAnalytics] = useState(null);
  const [tab, setTab] = useState("log");
  const [editingGame, setEditingGame] = useState(null);
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

  const isOwner = group.role === "owner";
  const canManageMembers = isOwner || group.role === "admin";
  const canLog = isOwner || group.role === "member" || group.role === "admin";
  const visibleTabs = TABS.filter((t) => t.id !== "log" || canLog);

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 sm:py-10">
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-3 mb-8">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-3 mb-2">
            <h1 className="font-display text-3xl sm:text-4xl md:text-5xl leading-none break-words min-w-0">
              {group.name}
            </h1>
            <span className="text-[10px] uppercase tracking-wide bg-court/20 text-court-light px-2 py-1 rounded-full shrink-0">
              {group.role}
            </span>
          </div>
          <p className="text-slate text-sm">Owned by {group.owner_name}</p>
        </div>
        <Link
          to={`/groups/${groupId}/members`}
          className="shrink-0 inline-flex items-center gap-2 border border-white/15 hover:border-amber/60 rounded-sm px-4 py-2 text-sm font-semibold text-chalk transition-colors"
        >
          Members
          <span className="scoreboard-digit text-xs text-slate">{members.length}</span>
        </Link>
      </div>

      <div className="flex flex-wrap gap-3 mb-10">
        <TopPlayersTile
          playerStats={analytics.playerStats}
          rankingMethod={analytics.rankingMethod}
          onViewAll={() => {
            setTab("standings");
            setEditingGame(null);
          }}
        />
        <TopPairsTile pairStats={analytics.pairStats} rankingMethod={analytics.rankingMethod} />
      </div>

      <div className="flex gap-1 border-b border-white/10 mb-8 overflow-x-auto">
        {visibleTabs.map((t) => (
          <button
            key={t.id}
            onClick={() => {
              setTab(t.id);
              setEditingGame(null);
            }}
            className={`px-4 py-2.5 text-sm font-semibold border-b-2 -mb-px transition-colors whitespace-nowrap shrink-0 ${
              tab === t.id ? "border-amber text-chalk" : "border-transparent text-slate hover:text-chalk"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "log" && canLog && (
        <LogGameForm
          groupId={groupId}
          members={members}
          editingGame={editingGame}
          onCancelEdit={() => setEditingGame(null)}
          onSaved={() => {
            setEditingGame(null);
            loadAll();
          }}
        />
      )}
      {tab === "history" && (
        <GameHistoryList
          games={games}
          onChanged={loadAll}
          canManage={canLog}
          onEdit={(game) => {
            setEditingGame(game);
            setTab("log");
          }}
        />
      )}
      {tab === "standings" && (
        <>
          {isOwner && (
            <div className="mb-5">
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <label htmlFor="ranking-method" className="text-slate">
                  Rank players by
                </label>
                <select
                  id="ranking-method"
                  value={group.ranking_method}
                  onChange={async (e) => {
                    const updated = await api.setRankingMethod(groupId, e.target.value);
                    setGroup(updated);
                    loadAll();
                  }}
                  className="bg-courtink-2 border border-white/10 rounded-sm px-2 py-1 text-chalk focus:outline-none focus:border-amber"
                >
                  <option value="win_percentage">Win %</option>
                  <option value="points">Points (+/- per game)</option>
                  <option value="elo">Ranked (skill rating)</option>
                </select>
              </div>
              <p className="text-xs text-slate mt-1.5 max-w-md">
                {group.ranking_method === "elo" &&
                  "Beating a stronger opponent gains more, beating a weaker one gains less — same for losses. Everyone starts at 1000."}
                {group.ranking_method === "points" &&
                  "Every win is worth the same +10, every loss the same -10, regardless of opponent."}
                {group.ranking_method === "win_percentage" &&
                  "Ranked purely by win rate — a player who's 2-0 outranks one who's 18-4."}
              </p>
            </div>
          )}
          <StandingsView analytics={analytics} />
        </>
      )}
      {tab === "tournaments" && <TournamentsTab groupId={groupId} members={members} isOwner={isOwner} />}
    </div>
  );
}
