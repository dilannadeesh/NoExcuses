import { getPool, ensureSchema, sendJson, readJsonBody } from "../_lib/db.js";

export default async function handler(req, res) {
  await ensureSchema();
  const db = getPool();

  if (req.method === "GET") {
    const { rows } = await db.query(`
      SELECT g.*,
        (SELECT COUNT(*)::int FROM group_members gm WHERE gm.group_id = g.id) AS member_count,
        (SELECT COUNT(*)::int FROM games ga WHERE ga.group_id = g.id) AS game_count
      FROM groups g ORDER BY g.created_at DESC
    `);
    return sendJson(res, 200, rows);
  }

  if (req.method === "POST") {
    const { name } = await readJsonBody(req);
    if (!name || !name.trim()) return sendJson(res, 400, { error: "Name is required" });
    const { rows } = await db.query("INSERT INTO groups (name) VALUES ($1) RETURNING *", [name.trim()]);
    return sendJson(res, 201, rows[0]);
  }

  res.setHeader("Allow", "GET, POST");
  return sendJson(res, 405, { error: "Method not allowed" });
}
