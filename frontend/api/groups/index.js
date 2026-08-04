import { getPool, ensureSchema, sendJson, readJsonBody } from "../_lib/db.js";
import { requireAuth } from "../_lib/auth.js";

export default async function handler(req, res) {
  const session = requireAuth(req, res);
  if (!session) return;

  await ensureSchema();
  const db = getPool();

  if (req.method === "GET") {
    const { rows } = await db.query(
      `SELECT g.*, u.name AS owner_name,
        (SELECT COUNT(*)::int FROM group_members gm WHERE gm.group_id = g.id) AS member_count,
        (SELECT COUNT(*)::int FROM games ga WHERE ga.group_id = g.id) AS game_count
      FROM groups g
      JOIN users u ON u.id = g.owner_id
      WHERE $1::boolean = true
         OR g.owner_id = $2
         OR EXISTS (SELECT 1 FROM group_members gm2 WHERE gm2.group_id = g.id AND gm2.user_id = $2)
      ORDER BY g.created_at DESC`,
      [session.isAdmin, session.sub]
    );
    return sendJson(res, 200, rows);
  }

  if (req.method === "POST") {
    const { name } = await readJsonBody(req);
    if (!name || !name.trim()) return sendJson(res, 400, { error: "Name is required" });

    const client = await db.connect();
    try {
      await client.query("BEGIN");
      const { rows } = await client.query(
        "INSERT INTO groups (name, owner_id) VALUES ($1, $2) RETURNING *",
        [name.trim(), session.sub]
      );
      const group = rows[0];
      // The creator is automatically a member so they can log their own games.
      await client.query("INSERT INTO group_members (group_id, user_id) VALUES ($1, $2)", [
        group.id,
        session.sub,
      ]);
      await client.query("COMMIT");
      return sendJson(res, 201, group);
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
