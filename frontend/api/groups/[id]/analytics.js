import { getPool, ensureSchema, sendJson, isDeuceSet } from "../../_lib/db.js";
import { requireAuth } from "../../_lib/auth.js";
import { getGroupRole } from "../../_lib/authz.js";

export default async function handler(req, res) {
  const session = requireAuth(req, res);
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

  const { rows: games } = await db.query("SELECT * FROM games WHERE group_id = $1", [groupId]);

  if (games.length === 0) {
    return sendJson(res, 200, { totalGames: 0, deucePercentage: 0, playerStats: [], pairStats: [] });
  }

  const gameIds = games.map((g) => g.id);
  const gamesById = new Map(games.map((g) => [g.id, g]));

  const { rows: sets } = await db.query("SELECT * FROM game_sets WHERE game_id = ANY($1::int[])", [gameIds]);
  const { rows: gamePlayers } = await db.query(
    `SELECT gp.*, u.name FROM game_players gp JOIN users u ON u.id = gp.user_id
     WHERE gp.game_id = ANY($1::int[])`,
    [gameIds]
  );

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
    }))
    .sort((a, b) => b.winPercentage - a.winPercentage || b.games - a.games);

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
      pairMap.set(key, { key, names: sortedIds.map((p) => p.name), wins: 0, losses: 0 });
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
    }))
    .sort((a, b) => b.winPercentage - a.winPercentage || b.games - a.games);

  return sendJson(res, 200, {
    totalGames: games.length,
    deucePercentage,
    deuceGames: deuceGameIds.size,
    playerStats,
    pairStats,
    bestPair: pairStats[0] || null,
  });
}
