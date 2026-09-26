import { getPool, ensureSchema, sendJson, readJsonBody } from "../../_lib/db.js";
import { requireAuth } from "../../_lib/auth.js";
import { getGroupRole, isOwner } from "../../_lib/authz.js";

const VALID_RANKING_METHODS = ["win_percentage", "points", "elo"];

export default async function handler(req, res) {
  const session = requireAuth(req, res);
  if (!session) return;

  await ensureSchema();
  const db = getPool();
  const { id } = req.query;
  const role = await getGroupRole(db, id, session);
  if (!role) return sendJson(res, 404, { error: "Group not found" });

  if (req.method === "GET") {
    const { rows } = await db.query(
      `SELECT g.*, u.name AS owner_name FROM groups g JOIN users u ON u.id = g.owner_id WHERE g.id = $1`,
      [id]
    );
    return sendJson(res, 200, { ...rows[0], role });
  }

  if (req.method === "PATCH") {
    if (!isOwner(role)) return sendJson(res, 403, { error: "Only the group owner can change group settings" });
    const { ranking_method } = await readJsonBody(req);
    if (!VALID_RANKING_METHODS.includes(ranking_method)) {
      return sendJson(res, 400, { error: `ranking_method must be one of: ${VALID_RANKING_METHODS.join(", ")}` });
    }
    const { rows } = await db.query(
      "UPDATE groups SET ranking_method = $1 WHERE id = $2 RETURNING *",
      [ranking_method, id]
    );
    return sendJson(res, 200, { ...rows[0], role });
  }

  if (req.method === "DELETE") {
    if (role !== "owner" && role !== "admin") return sendJson(res, 403, { error: "Not allowed" });
    await db.query("DELETE FROM groups WHERE id = $1", [id]);
    return res.status(204).end();
  }

  res.setHeader("Allow", "GET, PATCH, DELETE");
  return sendJson(res, 405, { error: "Method not allowed" });
}
