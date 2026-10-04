import { useEffect, useState, useCallback } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { Check, ChevronRight, Plus, Users } from "lucide-react";
import { api } from "../api";
import TopPlayersTile from "../components/TopPlayersTile";
import TopPairsTile from "../components/TopPairsTile";
import GameHistoryList from "../components/GameHistoryList";
import StandingsView from "../components/StandingsView";
import TournamentsTab from "../components/TournamentsTab";
import Screen from "../components/Screen";
import { LoadingBlock, ErrorNote } from "../components/States";

const TABS = [
  { id: "history", label: "History" },
  { id: "standings", label: "Standings" },
  { id: "tournaments", label: "Tournaments" },
];

const METHODS = [
  { id: "win_percentage", title: "Win %", desc: "Ranked by win rate. A player who’s 2–0 outranks one who’s 18–4." },
  { id: "points", title: "Points", desc: "+10 for every win and −10 for every loss, whoever the opponent is." },
  {
    id: "elo",
    title: "Skill rating",
    desc: "Elo-style: beating a stronger opponent earns more, losing to a weaker one costs more. Everyone starts at 1000.",
  },
];

export default function GroupDetailPage() {
  const { groupId } = useParams();
  const navigate = useNavigate();
  const [group, setGroup] = useState(null);
  const [members, setMembers] = useState([]);
  const [games, setGames] = useState([]);
  const [analytics, setAnalytics] = useState(null);
  const [tab, setTab] = useState("history");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [methodError, setMethodError] = useState("");

  const loadAll = useCallback(async () => {
    try {
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
      setError("");
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [groupId]);

  useEffect(() => {
    setLoading(true);
    loadAll();
  }, [loadAll]);

  if (loading) {
    return (
      <Screen>
        <LoadingBlock rows={4} />
      </Screen>
    );
  }
  if (error || !group) {
    return (
      <Screen>
        <ErrorNote>{error || "Group not found."}</ErrorNote>
      </Screen>
    );
  }

  const isOwner = group.role === "owner";
  const canLog = isOwner || group.role === "member" || group.role === "admin";

  const chooseMethod = async (id) => {
    if (id === group.ranking_method) return;
    setMethodError("");
    try {
      const updated = await api.setRankingMethod(groupId, id);
      setGroup(updated);
      loadAll();
    } catch (e) {
      setMethodError(e.message);
    }
  };

  return (
    <Screen bottom={canLog ? "cta" : "none"}>
      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-brand-light via-brand to-[#4A3FE0] p-5 text-white shadow-card">
        <div aria-hidden className="pointer-events-none absolute -right-10 -top-12 h-44 w-44 rounded-full bg-white/10" />
        <div aria-hidden className="pointer-events-none absolute -bottom-16 right-12 h-36 w-36 rounded-full bg-white/10" />
        <div className="relative">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-white/20 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide">
              {group.role}
            </span>
            <span className="text-xs text-white/80">Owned by {group.owner_name}</span>
          </div>
          <h1 className="mt-3 break-words text-[30px] font-extrabold leading-[1.1] tracking-tight">{group.name}</h1>
          <div className="mt-5 flex items-center justify-between gap-3">
            <p className="num flex items-center gap-1.5 text-sm text-white/85">
              <Users size={15} /> {members.length} players · {analytics.totalGames} games
            </p>
            <Link
              to={`/groups/${groupId}/members`}
              className="btn h-10 shrink-0 bg-white px-4 text-sm text-ink"
            >
              Members <ChevronRight size={16} strokeWidth={2.6} />
            </Link>
          </div>
        </div>
      </section>

      <div className="mt-4 space-y-4">
        <TopPlayersTile
          playerStats={analytics.playerStats}
          rankingMethod={analytics.rankingMethod}
          onViewAll={() => setTab("standings")}
        />
        <TopPairsTile pairStats={analytics.pairStats} rankingMethod={analytics.rankingMethod} />
      </div>

      <div className="seg mb-4 mt-7" role="tablist">
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

      {tab === "history" && (
        <GameHistoryList
          games={games}
          onChanged={loadAll}
          canManage={canLog}
          onEdit={(game) => navigate(`/groups/${groupId}/log/${game.id}`)}
        />
      )}

      {tab === "standings" && (
        <>
          {isOwner && (
            <section className="mb-5">
              <h2 className="section-title mb-3 px-1">Rank players by</h2>
              <div className="space-y-2.5" role="radiogroup" aria-label="Ranking method">
                {METHODS.map((m) => {
                  const selected = group.ranking_method === m.id;
                  return (
                    <button
                      key={m.id}
                      role="radio"
                      aria-checked={selected}
                      onClick={() => chooseMethod(m.id)}
                      className={`card flex w-full items-start gap-3 p-4 text-left transition active:scale-[0.99] ${
                        selected ? "ring-2 ring-ink" : "ring-1 ring-transparent"
                      }`}
                    >
                      <span
                        className={`mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full ${
                          selected ? "bg-ink text-white" : "border-2 border-line"
                        }`}
                      >
                        {selected && <Check size={14} strokeWidth={3} />}
                      </span>
                      <span className="min-w-0">
                        <span className="block font-bold">{m.title}</span>
                        <span className="mt-0.5 block text-sm leading-relaxed text-muted">{m.desc}</span>
                      </span>
                    </button>
                  );
                })}
              </div>
              <ErrorNote className="mt-3">{methodError}</ErrorNote>
            </section>
          )}
          <StandingsView analytics={analytics} />
        </>
      )}

      {tab === "tournaments" && <TournamentsTab groupId={groupId} members={members} isOwner={isOwner} />}

      {canLog && (
        <div className="pointer-events-none fixed inset-x-0 bottom-0 z-30 flex justify-center px-5 pb-[max(1rem,env(safe-area-inset-bottom))]">
          <Link
            to={`/groups/${groupId}/log`}
            className="btn-primary pointer-events-auto w-full max-w-md shadow-float md:max-w-xl"
          >
            <Plus size={20} strokeWidth={2.6} /> Log a game
          </Link>
        </div>
      )}
    </Screen>
  );
}
