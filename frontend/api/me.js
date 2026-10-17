import { getPool, ensureSchema, sendJson, readJsonBody } from "./_lib/db.js";
import { requireAuth, verifyPassword, clearSessionCookie } from "./_lib/auth.js";

// Delete my own account (App Store guideline 5.1.1(v) requires this inside the app).
// Nothing a group depends on is destroyed:
//  - groups I own go to another member (or are removed if I'm the only one in them)
//  - games/tournaments I played in, and expenses I paid or shared, keep their numbers; my row is anonymised
//    ("Deleted player") instead of deleted, because deleting it would cascade into
//    other people's game history
//  - an account with no such history is removed outright
async function deleteMyAccount(req, res, session) {
  const { password } = await readJsonBody(req);
  await ensureSchema();
  const db = getPool();
  const myId = session.sub;

  const { rows } = await db.query("SELECT * FROM users WHERE id = $1", [myId]);
  const me = rows[0];
  if (!me) return sendJson(res, 404, { error: "Account not found" });
  if (!password || !me.password_hash || !(await verifyPassword(password, me.password_hash))) {
    return sendJson(res, 403, { error: "That password isn't right." });
  }

  if (me.is_admin) {
    const { rows: n } = await db.query("SELECT COUNT(*)::int AS n FROM users WHERE is_admin = true AND is_active = true AND id <> $1", [myId]);
    if (n[0].n === 0) {
      return sendJson(res, 409, { error: "You're the only admin. Make someone else an admin before deleting your account." });
    }
  }

  const client = await db.connect();
  try {
    await client.query("BEGIN");

    const { rows: owned } = await client.query("SELECT id FROM groups WHERE owner_id = $1", [myId]);
    for (const g of owned) {
      const { rows: others } = await client.query(
        `SELECT u.id FROM group_members gm JOIN users u ON u.id = gm.user_id
          WHERE gm.group_id = $1 AND gm.user_id <> $2
          ORDER BY (u.password_hash IS NOT NULL AND u.is_active) DESC, u.id ASC LIMIT 1`,
        [g.id, myId]
      );
      if (others[0]) {
        await client.query("UPDATE groups SET owner_id = $1 WHERE id = $2", [others[0].id, g.id]);
      } else {
        await client.query("DELETE FROM groups WHERE id = $1", [g.id]);
      }
    }

    const { rows: played } = await client.query(
      `SELECT (EXISTS (SELECT 1 FROM game_players WHERE user_id = $1)
            OR EXISTS (SELECT 1 FROM tournament_entries WHERE player1_id = $1 OR player2_id = $1)
            OR EXISTS (SELECT 1 FROM expenses WHERE paid_by = $1)
            OR EXISTS (SELECT 1 FROM expense_splits WHERE user_id = $1)) AS has_history`,
      [myId]
    );

    await client.query("DELETE FROM password_reset_tokens WHERE user_id = $1", [myId]);
    await client.query("DELETE FROM push_tokens WHERE user_id = $1", [myId]);
    await client.query("DELETE FROM group_members WHERE user_id = $1", [myId]);
    if (played[0].has_history) {
      await client.query(
        `UPDATE users SET name = 'Deleted player', email = $2, password_hash = NULL,
                is_admin = false, is_active = false WHERE id = $1`,
        [myId, `deleted-${myId}@deleted.invalid`]
      );
    } else {
      await client.query("DELETE FROM users WHERE id = $1", [myId]);
    }
    await client.query("COMMIT");
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }

  clearSessionCookie(res);
  return res.status(204).end();
}

// Phones register (POST) and unregister (DELETE) their push token here:
// /api/me?push=1. A token belongs to whoever registered it last, so a phone
// that changes accounts stops notifying the old one.
async function pushToken(req, res, session) {
  await ensureSchema();
  const db = getPool();
  const { token, platform } = await readJsonBody(req);
  if (typeof token !== "string" || !/^[A-Za-z0-9:_\-]{20,4096}$/.test(token)) {
    return sendJson(res, 400, { error: "A valid push token is required" });
  }
  if (req.method === "DELETE") {
    await db.query("DELETE FROM push_tokens WHERE token = $1 AND user_id = $2", [token, session.sub]);
    return res.status(204).end();
  }
  if (platform !== "ios" && platform !== "android") return sendJson(res, 400, { error: "platform must be ios or android" });
  await db.query(
    `INSERT INTO push_tokens (token, user_id, platform) VALUES ($1, $2, $3)
     ON CONFLICT (token) DO UPDATE SET user_id = EXCLUDED.user_id, platform = EXCLUDED.platform, updated_at = now()`,
    [token, session.sub, platform]
  );
  return res.status(204).end();
}

export default async function handler(req, res) {
  const session = await requireAuth(req, res);
  if (!session) return;
  if (req.query.push !== undefined && (req.method === "POST" || req.method === "DELETE")) return pushToken(req, res, session);
  if (req.method === "DELETE") return deleteMyAccount(req, res, session);
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET, DELETE, POST");
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
