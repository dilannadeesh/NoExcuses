import { getPool, ensureSchema, sendJson, readJsonBody, isDeuceSet } from "../_lib/db.js";
import { requireAuth } from "../_lib/auth.js";
import { getGroupRole, canLogGames } from "../_lib/authz.js";
import { validateGameShape, allPlayersAreMembers, computeWinnerSide } from "../_lib/gameLogic.js";

export default async function handler(req, res) {
  const session = requireAuth(req, res);
  if (!session) return;

  await ensureSchema();
  const db = getPool();
  const { id } = req.query;

  const { rows } = await db.query("SELECT * FROM games WHERE id = $1", [id]);
  if (!rows[0]) return sendJson(res, 404, { error: "Game not found" });
  const game = rows[0];
  const role = await getGroupRole(db, game.group_id, session);
  if (!role) return sendJson(res, 404, { error: "Game not found" });

  if (req.method === "GET") {
    const { rows: players } = await db.query(
      `SELECT gp.side, u.id, u.name FROM game_players gp
       JOIN users u ON u.id = gp.user_id WHERE gp.game_id = $1`,
      [id]
    );
    const { rows: sets } = await db.query(
      "SELECT set_number, side1_score, side2_score FROM game_sets WHERE game_id = $1 ORDER BY set_number",
      [id]
    );
    return sendJson(res, 200, {
      ...game,
      side1: players.filter((p) => p.side === 1).map(({ id, name }) => ({ id, name })),
      side2: players.filter((p) => p.side === 2).map(({ id, name }) => ({ id, name })),
      sets,
      went_to_deuce: sets.some((s) => isDeuceSet(s.side1_score, s.side2_score)),
    });
  }

  if (req.method === "PATCH") {
    if (!canLogGames(role)) return sendJson(res, 403, { error: "Not allowed" });

    const { match_type, played_at, side1, side2, sets } = await readJsonBody(req);
    const validationError = validateGameShape(match_type, side1, side2, sets);
    if (validationError) return sendJson(res, 400, { error: validationError });

    if (!(await allPlayersAreMembers(db, game.group_id, side1, side2))) {
      return sendJson(res, 400, { error: "All selected players must be members of this group" });
    }

    const winnerSide = computeWinnerSide(sets);

    const client = await db.connect();
    try {
      await client.query("BEGIN");
      await client.query(
        "UPDATE games SET match_type = $1, played_at = $2, winner_side = $3 WHERE id = $4",
        [match_type, played_at || game.played_at, winnerSide, id]
      );
      // Simplest correct approach: replace the lineup and sets entirely
      // rather than trying to diff old vs new -- this is a full edit, not
      // a patch of individual fields within them.
      await client.query("DELETE FROM game_players WHERE game_id = $1", [id]);
      await client.query("DELETE FROM game_sets WHERE game_id = $1", [id]);

      for (const pid of side1) {
        await client.query("INSERT INTO game_players (game_id, user_id, side) VALUES ($1, $2, 1)", [id, pid]);
      }
      for (const pid of side2) {
        await client.query("INSERT INTO game_players (game_id, user_id, side) VALUES ($1, $2, 2)", [id, pid]);
      }
      for (let i = 0; i < sets.length; i++) {
        await client.query(
          "INSERT INTO game_sets (game_id, set_number, side1_score, side2_score) VALUES ($1, $2, $3, $4)",
          [id, i + 1, sets[i].side1_score, sets[i].side2_score]
        );
      }

      await client.query("COMMIT");
    } catch (e) {
      await client.query("ROLLBACK");
      throw e;
    } finally {
      client.release();
    }

    const { rows: updated } = await db.query("SELECT * FROM games WHERE id = $1", [id]);
    return sendJson(res, 200, updated[0]);
  }

  if (req.method === "DELETE") {
    if (!canLogGames(role)) return sendJson(res, 403, { error: "Not allowed" });
    await db.query("DELETE FROM games WHERE id = $1", [id]);
    return res.status(204).end();
  }

  res.setHeader("Allow", "GET, PATCH, DELETE");
  return sendJson(res, 405, { error: "Method not allowed" });
}
