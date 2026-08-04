import { getPool, ensureSchema, sendJson } from "../_lib/db.js";
import { requireAuth } from "../_lib/auth.js";
import { getGroupRole, canLogGames } from "../_lib/authz.js";

export default async function handler(req, res) {
  const session = requireAuth(req, res);
  if (!session) return;

  await ensureSchema();
  const db = getPool();
  const { id } = req.query;

  const { rows } = await db.query("SELECT group_id FROM games WHERE id = $1", [id]);
  if (!rows[0]) return sendJson(res, 404, { error: "Game not found" });
  const role = await getGroupRole(db, rows[0].group_id, session);
  if (!role) return sendJson(res, 404, { error: "Game not found" });

  if (req.method === "DELETE") {
    if (!canLogGames(role)) return sendJson(res, 403, { error: "Not allowed" });
    await db.query("DELETE FROM games WHERE id = $1", [id]);
    return res.status(204).end();
  }

  res.setHeader("Allow", "DELETE");
  return sendJson(res, 405, { error: "Method not allowed" });
}
