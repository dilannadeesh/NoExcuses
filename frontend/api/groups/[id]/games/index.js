import { getPool, ensureSchema, sendJson, readJsonBody, isDeuceSet } from "../../../_lib/db.js";

export default async function handler(req, res) {
  await ensureSchema();
  const db = getPool();
  const { id: groupId } = req.query;

  if (req.method === "GET") {
    const { rows: games } = await db.query(
      "SELECT * FROM games WHERE group_id = $1 ORDER BY played_at DESC, id DESC",
      [groupId]
    );
    if (games.length === 0) return sendJson(res, 200, []);

    const gameIds = games.map((g) => g.id);
    const { rows: allPlayers } = await db.query(
      `SELECT gp.game_id, gp.side, p.id, p.name FROM game_players gp
       JOIN players p ON p.id = gp.player_id WHERE gp.game_id = ANY($1::int[])`,
      [gameIds]
    );
    const { rows: allSets } = await db.query(
      `SELECT game_id, set_number, side1_score, side2_score FROM game_sets
       WHERE game_id = ANY($1::int[]) ORDER BY set_number`,
      [gameIds]
    );

    const withDetails = games.map((game) => {
      const players = allPlayers.filter((p) => p.game_id === game.id);
      const sets = allSets.filter((s) => s.game_id === game.id);
      return {
        ...game,
        side1: players.filter((p) => p.side === 1).map(({ id, name }) => ({ id, name })),
        side2: players.filter((p) => p.side === 2).map(({ id, name }) => ({ id, name })),
        sets,
        went_to_deuce: sets.some((s) => isDeuceSet(s.side1_score, s.side2_score)),
      };
    });
    return sendJson(res, 200, withDetails);
  }

  if (req.method === "POST") {
    const { match_type, played_at, side1, side2, sets } = await readJsonBody(req);

    if (!["singles", "doubles"].includes(match_type)) {
      return sendJson(res, 400, { error: "match_type must be 'singles' or 'doubles'" });
    }
    const expectedCount = match_type === "singles" ? 1 : 2;
    if (!Array.isArray(side1) || !Array.isArray(side2) || side1.length !== expectedCount || side2.length !== expectedCount) {
      return sendJson(res, 400, { error: `Each side needs exactly ${expectedCount} player(s)` });
    }
    if (!Array.isArray(sets) || sets.length === 0) {
      return sendJson(res, 400, { error: "At least one set is required" });
    }

    let side1Sets = 0;
    let side2Sets = 0;
    for (const s of sets) {
      if (s.side1_score > s.side2_score) side1Sets++;
      else if (s.side2_score > s.side1_score) side2Sets++;
    }
    const winnerSide = side1Sets > side2Sets ? 1 : 2;

    const client = await db.connect();
    try {
      await client.query("BEGIN");
      const { rows } = await client.query(
        "INSERT INTO games (group_id, match_type, played_at, winner_side) VALUES ($1, $2, $3, $4) RETURNING id",
        [groupId, match_type, played_at || new Date().toISOString().slice(0, 10), winnerSide]
      );
      const gameId = rows[0].id;

      for (const pid of side1) {
        await client.query("INSERT INTO game_players (game_id, player_id, side) VALUES ($1, $2, 1)", [gameId, pid]);
      }
      for (const pid of side2) {
        await client.query("INSERT INTO game_players (game_id, player_id, side) VALUES ($1, $2, 2)", [gameId, pid]);
      }
      for (let i = 0; i < sets.length; i++) {
        await client.query(
          "INSERT INTO game_sets (game_id, set_number, side1_score, side2_score) VALUES ($1, $2, $3, $4)",
          [gameId, i + 1, sets[i].side1_score, sets[i].side2_score]
        );
      }

      await client.query("COMMIT");
      return sendJson(res, 201, { id: gameId });
    } catch (e) {
      await client.query("ROLLBACK");
      throw e;
    } finally {
      client.release();
    }
  }

  res.setHeader("Allow", "GET, POST");
  return sendJson(res, 405, { error: "Method not allowed" });
}
