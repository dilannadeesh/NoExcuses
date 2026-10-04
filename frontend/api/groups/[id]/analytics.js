import { getPool, ensureSchema, sendJson, isDeuceSet } from "../../_lib/db.js";
import { requireAuth } from "../../_lib/auth.js";
import { getGroupRole } from "../../_lib/authz.js";

// Simple fixed-point ladder for the "points" ranking method: a win is worth
// this many points, a loss costs this many.
const POINTS_PER_WIN = 10;
const POINTS_PER_LOSS = 10;

// Elo-style "ranked" method: point swings scale with how surprising the
// result was, based on the rating gap between the two sides. Doubles teams
// are rated as the average of their two players' current ratings, and the
// resulting swing is applied equally to both players on a side -- same
// pattern as the flat "points" method, just no longer a fixed amount.
const ELO_STARTING_RATING = 1000;
const ELO_K_FACTOR = 32;

// games must already be sorted chronologically (oldest first) -- each
// game's swing depends on both sides' ratings AT THAT POINT IN TIME, so
// replaying out of order would produce wrong results.
function computeEloRatings(gamesChronological, gamePlayersByGameId) {
  const ratings = new Map(); // user_id -> current rating
  const getRating = (id) => ratings.get(id) ?? ELO_STARTING_RATING;

  for (const game of gamesChronological) {
    const players = gamePlayersByGameId.get(game.id) || [];
    const side1 = players.filter((p) => p.side === 1).map((p) => p.user_id);
    const side2 = players.filter((p) => p.side === 2).map((p) => p.user_id);
    if (side1.length === 0 || side2.length === 0) continue;

    const side1Avg = side1.reduce((sum, id) => sum + getRating(id), 0) / side1.length;
    const side2Avg = side2.reduce((sum, id) => sum + getRating(id), 0) / side2.length;

    const expectedSide1 = 1 / (1 + Math.pow(10, (side2Avg - side1Avg) / 400));
    const actualSide1 = game.winner_side === 1 ? 1 : 0;
    const delta = ELO_K_FACTOR * (actualSide1 - expectedSide1); // positive if side 1 won

    for (const id of side1) ratings.set(id, getRating(id) + delta);
    for (const id of side2) ratings.set(id, getRating(id) - delta);
  }

  return ratings;
}

export default async function handler(req, res) {
  const session = await requireAuth(req, res);
  if (!session) return;

  await ensureSchema();
  const db = getPool();
  const { id: groupId } = req.query;
  const role = await getGroupRole(db, groupId, session);
  if (!role) return sendJson(res, 404, { error: "Group not found" });

  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return sendJson(res, 405, { error: "Method not allowed" });
  }

  const { rows: groupRows } = await db.query("SELECT ranking_method FROM groups WHERE id = $1", [groupId]);
  const rankingMethod = groupRows[0]?.ranking_method || "win_percentage";

  const { rows: games } = await db.query("SELECT * FROM games WHERE group_id = $1", [groupId]);

  if (games.length === 0) {
    return sendJson(res, 200, {
      totalGames: 0,
      deucePercentage: 0,
      playerStats: [],
      pairStats: [],
      rankingMethod,
    });
  }

  const gameIds = games.map((g) => g.id);
  const gamesById = new Map(games.map((g) => [g.id, g]));

  const { rows: sets } = await db.query("SELECT * FROM game_sets WHERE game_id = ANY($1::int[])", [gameIds]);
  const { rows: gamePlayers } = await db.query(
    `SELECT gp.*, u.name FROM game_players gp JOIN users u ON u.id = gp.user_id
     WHERE gp.game_id = ANY($1::int[])`,
    [gameIds]
  );

  // Elo needs games replayed oldest-first, since each game's swing depends
  // on ratings as they stood at that point in time.
  const gamesChronological = [...games].sort(
    (a, b) => new Date(a.played_at) - new Date(b.played_at) || a.id - b.id
  );
  const gamePlayersByGameId = new Map();
  for (const gp of gamePlayers) {
    if (!gamePlayersByGameId.has(gp.game_id)) gamePlayersByGameId.set(gp.game_id, []);
    gamePlayersByGameId.get(gp.game_id).push(gp);
  }
  const eloRatings = computeEloRatings(gamesChronological, gamePlayersByGameId);

  const deuceGameIds = new Set(
    sets.filter((s) => isDeuceSet(s.side1_score, s.side2_score)).map((s) => s.game_id)
  );
  const deucePercentage = Math.round((deuceGameIds.size / games.length) * 1000) / 10;

  // Per-player win/loss
  const playerMap = new Map();
  for (const gp of gamePlayers) {
    const game = gamesById.get(gp.game_id);
    if (!playerMap.has(gp.user_id)) {
      playerMap.set(gp.user_id, { id: gp.user_id, name: gp.name, wins: 0, losses: 0 });
    }
    const entry = playerMap.get(gp.user_id);
    if (game.winner_side === gp.side) entry.wins++;
    else entry.losses++;
  }

  const playerStats = [...playerMap.values()]
    .map((p) => ({
      ...p,
      games: p.wins + p.losses,
      winPercentage: Math.round((p.wins / (p.wins + p.losses)) * 1000) / 10,
      points: p.wins * POINTS_PER_WIN - p.losses * POINTS_PER_LOSS,
      eloRating: Math.round(eloRatings.get(p.id) ?? ELO_STARTING_RATING),
    }))
    .sort((a, b) => {
      if (rankingMethod === "elo") return b.eloRating - a.eloRating || b.games - a.games;
      if (rankingMethod === "points") return b.points - a.points || b.games - a.games;
      return b.winPercentage - a.winPercentage || b.games - a.games;
    });

  // Doubles pair stats
  const doublesGameIds = new Set(games.filter((g) => g.match_type === "doubles").map((g) => g.id));
  const sideGroups = new Map();
  for (const gp of gamePlayers) {
    if (!doublesGameIds.has(gp.game_id)) continue;
    const key = `${gp.game_id}-${gp.side}`;
    if (!sideGroups.has(key)) sideGroups.set(key, { game_id: gp.game_id, side: gp.side, players: [] });
    sideGroups.get(key).players.push({ id: gp.user_id, name: gp.name });
  }

  const pairMap = new Map();
  for (const { game_id, side, players } of sideGroups.values()) {
    if (players.length !== 2) continue;
    const sortedIds = [...players].sort((a, b) => a.id - b.id);
    const key = sortedIds.map((p) => p.id).join("-");
    if (!pairMap.has(key)) {
      pairMap.set(key, {
        key,
        names: sortedIds.map((p) => p.name),
        playerIds: sortedIds.map((p) => p.id),
        wins: 0,
        losses: 0,
      });
    }
    const entry = pairMap.get(key);
    const game = gamesById.get(game_id);
    if (game.winner_side === side) entry.wins++;
    else entry.losses++;
  }

  const pairStats = [...pairMap.values()]
    .map((p) => ({
      ...p,
      games: p.wins + p.losses,
      winPercentage: Math.round((p.wins / (p.wins + p.losses)) * 1000) / 10,
      points: p.wins * POINTS_PER_WIN - p.losses * POINTS_PER_LOSS,
      // Pairs don't have their own separate Elo pool -- this is the average
      // of the two partners' individual current ratings, i.e. "how strong
      // is this pairing right now", not a history of this pairing's own
      // upsets/results the way individual Elo tracks a player's history.
      eloRating: Math.round(
        p.playerIds.reduce((sum, id) => sum + (eloRatings.get(id) ?? ELO_STARTING_RATING), 0) / p.playerIds.length
      ),
    }))
    .sort((a, b) => {
      if (rankingMethod === "elo") return b.eloRating - a.eloRating || b.games - a.games;
      if (rankingMethod === "points") return b.points - a.points || b.games - a.games;
      return b.winPercentage - a.winPercentage || b.games - a.games;
    });

  return sendJson(res, 200, {
    totalGames: games.length,
    deucePercentage,
    deuceGames: deuceGameIds.size,
    playerStats,
    pairStats,
    bestPair: pairStats[0] || null,
    rankingMethod,
  });
}
