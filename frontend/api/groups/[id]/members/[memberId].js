import { getPool, ensureSchema, sendJson } from "../../../_lib/db.js";
import { requireAuth } from "../../../_lib/auth.js";
import { getGroupRole, isOwner } from "../../../_lib/authz.js";

export default async function handler(req, res) {
  const session = requireAuth(req, res);
  if (!session) return;

  await ensureSchema();
  const db = getPool();
  const { id: groupId, memberId } = req.query;
  const role = await getGroupRole(db, groupId, session);
  if (!role) return sendJson(res, 404, { error: "Group not found" });

  if (req.method === "DELETE") {
    if (!isOwner(role)) return sendJson(res, 403, { error: "Only the group owner can remove members" });
    await db.query("DELETE FROM group_members WHERE group_id = $1 AND user_id = $2", [groupId, memberId]);
    return res.status(204).end();
  }

  res.setHeader("Allow", "DELETE");
  return sendJson(res, 405, { error: "Method not allowed" });
}
