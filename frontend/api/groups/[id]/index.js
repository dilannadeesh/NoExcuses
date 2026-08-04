import { getPool, ensureSchema, sendJson } from "../../_lib/db.js";
import { requireAuth } from "../../_lib/auth.js";
import { getGroupRole } from "../../_lib/authz.js";

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

  if (req.method === "DELETE") {
    if (role !== "owner" && role !== "admin") return sendJson(res, 403, { error: "Not allowed" });
    await db.query("DELETE FROM groups WHERE id = $1", [id]);
    return res.status(204).end();
  }

  res.setHeader("Allow", "GET, DELETE");
  return sendJson(res, 405, { error: "Method not allowed" });
}
