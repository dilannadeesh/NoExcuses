import { useEffect, useState, useCallback } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { CalendarClock, Check, Plus, UserPlus, Users } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { MemberWelcome, NextStepCard, OweTip, SetupChecklist } from "../components/GroupNudges";
import { dismiss, isDismissed, pickGroupNudge, setupProgress, showOweTip } from "../lib/nudges";
import { api } from "../api";
import TopPlayersTile from "../components/TopPlayersTile";
import BestPair from "../components/BestPair";
import GameHistoryList from "../components/GameHistoryList";
import StandingsView from "../components/StandingsView";
import TournamentsTab from "../components/TournamentsTab";
import Screen from "../components/Screen";
import { LoadingBlock, ErrorNote } from "../components/States";
import { todayKey } from "../lib/day";
import { formatMoney } from "../lib/money";

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
  const { user } = useAuth();
  const [, setNudgeTick] = useState(0); // re-render after a hint is dismissed
  const [group, setGroup] = useState(null);
  const [members, setMembers] = useState([]);
  const [games, setGames] = useState([]);
  const [analytics, setAnalytics] = useState(null);
  const [oweCents, setOweCents] = useState(0);
  const [tab, setTab] = useState("history");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [methodError, setMethodError] = useState("");

  const loadAll = useCallback(async () => {
    try {
      const [g, m, gm, a, bal] = await Promise.all([
        api.getGroup(groupId),
        api.listMembers(groupId),
        api.listGames(groupId),
        api.getAnalytics(groupId),
        // The Owe button is a nicety: never let it block the group page.
        api.getBalances(groupId).catch(() => null),
      ]);
      setOweCents(bal?.owe_cents ?? 0);
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
  // The group admin plans today's games; everyone else can view the plan, so
  // they only get the shortcut when there is one for today.
  const canPlan = isOwner || group.role === "admin";
  const planToday = group.schedule_date === todayKey();
  const ownerLine = isOwner
    ? "Owner"
    : group.role === "admin"
    ? `Admin view · owned by ${group.owner_name}`
    : `Owned by ${group.owner_name}`;

  // ---- first-run nudges (one at a time) ----
  const canManage = isOwner || group.role === "admin";
  const seen = (name) => isDismissed(user?.id, groupId, name);
  const hide = (name) => {
    dismiss(user?.id, groupId, name);
    setNudgeTick((n) => n + 1);
  };
  const nudgeInput = {
    role: group.role,
    memberCount: members.length,
    totalGames: analytics.totalGames,
    hasExpenses: group.has_expenses,
    plannedEver: Boolean(group.schedule_date) || !canPlan,
    hasPlayed: analytics.playerStats.some((p) => p.id === user?.id),
    dismissed: seen,
  };
  const nudge = pickGroupNudge(nudgeInput);
  const progress = setupProgress(nudgeInput);
  const oweTip = showOweTip({ role: group.role, groupNudge: nudge, hasExpenses: group.has_expenses, dismissed: seen });
  const needsPlayers = canManage && members.length < 2;
  const me = members.find((m) => m.id === user?.id);

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
      <div className="flex items-start justify-between gap-3 pb-4 pt-1">
        <div className="min-w-0">
          <h1 className="break-words display text-[32px]">{group.name}</h1>
          <p className="num mt-1.5 text-sm text-muted">
            {ownerLine} · {members.length} {members.length === 1 ? "player" : "players"} · {analytics.totalGames}{" "}
            {analytics.totalGames === 1 ? "game" : "games"}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <div className="relative">
            <Link
              to={`/groups/${groupId}/owe`}
              aria-describedby={oweTip ? "owe-tip" : undefined}
              onClick={() => oweTip && hide("owe-tip")}
              className={`btn-secondary num !px-4 ${oweTip ? "!border-lime ring-4 ring-lime/20" : ""}`}
            >
              Owe {formatMoney(oweCents)}
            </Link>
            {oweTip && <OweTip onDismiss={() => hide("owe-tip")} />}
          </div>
          <Link
            to={`/groups/${groupId}/members`}
            aria-label="Members"
            title="Members"
            className="btn-secondary !w-11 !px-0"
          >
            <Users size={18} />
          </Link>
        </div>
      </div>

      <div className="space-y-4">
        {nudge === "checklist" && (
          <SetupChecklist groupId={groupId} groupName={group.name} progress={progress} onDismiss={() => hide("checklist")} />
        )}
        {nudge?.startsWith("next:") && (
          <NextStepCard
            kind={nudge}
            groupId={groupId}
            doneCount={progress.doneCount}
            total={progress.total}
            onDismiss={() => hide(nudge)}
          />
        )}
        {nudge === "welcome" && (
          <MemberWelcome
            firstName={(me?.name || user?.name || "there").trim().split(/\s+/)[0]}
            ownerName={group.owner_name}
            groupName={group.name}
            onDismiss={() => hide("welcome")}
          />
        )}
        <TopPlayersTile
          currentUserId={members.length > 1 ? user?.id : undefined}
          groupName={group.name}
          playerStats={analytics.playerStats}
          rankingMethod={analytics.rankingMethod}
          onViewAll={() => setTab("standings")}
        />
        <BestPair pair={analytics.pairStats?.[0]} rankingMethod={analytics.rankingMethod} />
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
                        selected ? "ring-2 ring-lime" : "ring-1 ring-transparent"
                      }`}
                    >
                      <span
                        className={`mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full ${
                          selected ? "bg-lime text-onlime" : "border-2 border-line"
                        }`}
                      >
                        {selected && <Check size={14} strokeWidth={3} />}
                      </span>
                      <span className="min-w-0">
                        <span className="block font-semibold">{m.title}</span>
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
        <div className="pinned-bar">
        <div className="mx-auto max-w-md px-5 md:max-w-xl">
          <div className="flex gap-2">
            {needsPlayers ? (
              // You can't log a game on your own: the first job is adding players.
              <Link to={`/groups/${groupId}/members`} className="btn-primary flex-1">
                <UserPlus size={19} strokeWidth={2.4} /> Add players
              </Link>
            ) : (
              <Link to={`/groups/${groupId}/log`} className="btn-primary flex-1">
                <Plus size={19} strokeWidth={2.4} /> Log a game
              </Link>
            )}
            {(canPlan || planToday) && (
              <Link
                to={`/groups/${groupId}/schedule`}
                aria-label={canPlan ? "Schedule today's games" : "View today's schedule"}
                title={canPlan ? "Schedule today's games" : "View today's schedule"}
                className="btn-secondary relative !w-[60px] shrink-0 !px-0"
              >
                <CalendarClock size={21} />
                {planToday && <span aria-hidden="true" className="absolute right-2.5 top-2.5 h-2 w-2 rounded-full bg-brand" />}
              </Link>
            )}
          </div>
        </div>
      </div>
      )}
    </Screen>
  );
}
