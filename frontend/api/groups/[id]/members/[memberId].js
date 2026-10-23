import { getPool, ensureSchema, sendJson } from "../../../_lib/db.js";
import { requireAuth } from "../../../_lib/auth.js";
import { getGroupRole, canManageMembers } from "../../../_lib/authz.js";

export default async function handler(req, res) {
  const session = await requireAuth(req, res);
  if (!session) return;

  await ensureSchema();
  const db = getPool();
  const { id: groupId, memberId } = req.query;
  const role = await getGroupRole(db, groupId, session);
  if (!role) return sendJson(res, 404, { error: "Group not found" });

  if (req.method === "DELETE") {
    const leaving = Number(memberId) === session.sub;
    // Anyone may leave a group; only the owner or an admin may remove others.
    if (!leaving && !canManageMembers(role)) {
      return sendJson(res, 403, { error: "Only the group owner or an admin can remove members" });
    }
    const { rows } = await db.query("SELECT owner_id FROM groups WHERE id = $1", [groupId]);
    if (rows[0] && Number(memberId) === rows[0].owner_id) {
      return sendJson(res, 409, {
        error: leaving
          ? "You own this group, so you can't leave it. Hand it to another member first (contact support), or delete the group."
          : "The group owner can't be removed.",
      });
    }
    await db.query("DELETE FROM group_members WHERE group_id = $1 AND user_id = $2", [groupId, memberId]);
    return res.status(204).end();
  }

  res.setHeader("Allow", "DELETE");
  return sendJson(res, 405, { error: "Method not allowed" });
}
