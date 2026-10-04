import { getPool, ensureSchema, sendJson } from "./_lib/db.js";
import { requireAuth } from "./_lib/auth.js";

export default async function handler(req, res) {
  const session = await requireAuth(req, res);
  if (!session) return;
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return sendJson(res, 405, { error: "Method not allowed" });
  }

  await ensureSchema();
  const db = getPool();
  const myId = session.sub;

  const { rows: userRows } = await db.query("SELECT name FROM users WHERE id = $1", [myId]);
  const myName = userRows[0]?.name;

  // Scoped to groups I actually PLAY in (i.e. I'm a member), not every group
  // a global admin can merely see -- those are different concepts.
  const { rows: myGroups } = await db.query(
    `SELECT g.id, g.name, g.owner_id FROM groups g
     JOIN group_members gm ON gm.group_id = g.id
     WHERE gm.user_id = $1`,
    [myId]
  );

  if (myGroups.length === 0) {
    return sendJson(res, 200, {
      name: myName,
      totalGames: 0,
      wins: 0,
      losses: 0,
      winPercentage: 0,
      groups: [],
      headToHead: [],
      partners: [],
    });
  }

  const groupIds = myGroups.map((g) => g.id);
  const { rows: games } = await db.query("SELECT * FROM games WHERE group_id = ANY($1::int[])", [groupIds]);
  const gamesById = new Map(games.map((g) => [g.id, g]));
  const gameIds = games.map((g) => g.id);

  let gamePlayers = [];
  if (gameIds.length > 0) {
    const { rows } = await db.query(
      `SELECT gp.*, u.name FROM game_players gp JOIN users u ON u.id = gp.user_id
       WHERE gp.game_id = ANY($1::int[])`,
      [gameIds]
    );
    gamePlayers = rows;
  }

  const playersByGameId = new Map();
  for (const gp of gamePlayers) {
    if (!playersByGameId.has(gp.game_id)) playersByGameId.set(gp.game_id, []);
    playersByGameId.get(gp.game_id).push(gp);
  }

  const myRows = gamePlayers.filter((gp) => gp.user_id === myId);

  let wins = 0;
  let losses = 0;
  const perGroup = new Map(); // group_id -> { wins, losses }
  const headToHeadMap = new Map(); // opponent user_id -> { id, name, wins, losses }
  const partnerMap = new Map(); // partner user_id -> { id, name, wins, losses }

  for (const gp of myRows) {
    const game = gamesById.get(gp.game_id);
    const won = game.winner_side === gp.side;
    if (won) wins++;
    else losses++;

    if (!perGroup.has(game.group_id)) perGroup.set(game.group_id, { wins: 0, losses: 0 });
    const groupEntry = perGroup.get(game.group_id);
    if (won) groupEntry.wins++;
    else groupEntry.losses++;

    const others = playersByGameId.get(gp.game_id) || [];
    for (const other of others) {
      if (other.user_id === myId) continue;
      const targetMap = other.side === gp.side ? partnerMap : headToHeadMap;
      if (!targetMap.has(other.user_id)) {
        targetMap.set(other.user_id, { id: other.user_id, name: other.name, wins: 0, losses: 0 });
      }
      const entry = targetMap.get(other.user_id);
      if (won) entry.wins++;
      else entry.losses++;
    }
  }

  const withDerived = (entry) => ({
    ...entry,
    games: entry.wins + entry.losses,
    winPercentage: Math.round((entry.wins / (entry.wins + entry.losses)) * 1000) / 10,
  });

  const totalGames = wins + losses;
  const winPercentage = totalGames > 0 ? Math.round((wins / totalGames) * 1000) / 10 : 0;

  const groupsOut = myGroups
    .map((g) => {
      const stat = perGroup.get(g.id) || { wins: 0, losses: 0 };
      return {
        id: g.id,
        name: g.name,
        isOwner: g.owner_id === myId,
        ...withDerived(stat),
      };
    })
    .sort((a, b) => b.games - a.games);

  const headToHead = [...headToHeadMap.values()].map(withDerived).sort((a, b) => b.games - a.games);
  const partners = [...partnerMap.values()].map(withDerived).sort((a, b) => b.games - a.games);

  return sendJson(res, 200, {
    name: myName,
    totalGames,
    wins,
    losses,
    winPercentage,
    groups: groupsOut,
    headToHead,
    partners,
  });
}
