import { getPool, ensureSchema, sendJson, readJsonBody } from "../../../_lib/db.js";

export default async function handler(req, res) {
  await ensureSchema();
  const db = getPool();
  const { id: groupId } = req.query;

  if (req.method === "GET") {
    const { rows } = await db.query(
      `SELECT p.* FROM players p
       JOIN group_members gm ON gm.player_id = p.id
       WHERE gm.group_id = $1 ORDER BY p.name`,
      [groupId]
    );
    return sendJson(res, 200, rows);
  }

  if (req.method === "POST") {
    const { name, player_id } = await readJsonBody(req);
    let playerId = player_id;

    if (!playerId) {
      if (!name || !name.trim()) return sendJson(res, 400, { error: "Name or player_id is required" });
      // Upsert-by-name: insert, or return the existing row on a name conflict.
      const { rows } = await db.query(
        `INSERT INTO players (name) VALUES ($1)
         ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name
         RETURNING *`,
        [name.trim()]
      );
      playerId = rows[0].id;
    }

    await db.query(
      "INSERT INTO group_members (group_id, player_id) VALUES ($1, $2) ON CONFLICT DO NOTHING",
      [groupId, playerId]
    );
    const { rows: playerRows } = await db.query("SELECT * FROM players WHERE id = $1", [playerId]);
    return sendJson(res, 201, playerRows[0]);
  }

  res.setHeader("Allow", "GET, POST");
  return sendJson(res, 405, { error: "Method not allowed" });
}
