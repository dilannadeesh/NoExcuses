import { getPool, ensureSchema, sendJson } from "../../_lib/db.js";

export default async function handler(req, res) {
  await ensureSchema();
  const db = getPool();
  const { id } = req.query;

  if (req.method === "GET") {
    const { rows } = await db.query("SELECT * FROM groups WHERE id = $1", [id]);
    if (!rows[0]) return sendJson(res, 404, { error: "Group not found" });
    return sendJson(res, 200, rows[0]);
  }

  if (req.method === "DELETE") {
    await db.query("DELETE FROM groups WHERE id = $1", [id]);
    return res.status(204).end();
  }

  res.setHeader("Allow", "GET, DELETE");
  return sendJson(res, 405, { error: "Method not allowed" });
}
