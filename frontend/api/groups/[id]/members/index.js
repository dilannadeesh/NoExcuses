import { getPool, ensureSchema, sendJson, readJsonBody } from "../../../_lib/db.js";
import { requireAuth, isValidEmail } from "../../../_lib/auth.js";
import { getGroupRole, canManageMembers } from "../../../_lib/authz.js";

export default async function handler(req, res) {
  const session = requireAuth(req, res);
  if (!session) return;

  await ensureSchema();
  const db = getPool();
  const { id: groupId } = req.query;
  const role = await getGroupRole(db, groupId, session);
  if (!role) return sendJson(res, 404, { error: "Group not found" });

  if (req.method === "GET") {
    const { rows } = await db.query(
      `SELECT u.id, u.name, u.email, (u.password_hash IS NOT NULL) AS has_joined
       FROM users u
       JOIN group_members gm ON gm.user_id = u.id
       WHERE gm.group_id = $1 ORDER BY u.name`,
      [groupId]
    );
    return sendJson(res, 200, rows);
  }

  if (req.method === "POST") {
    if (!canManageMembers(role)) return sendJson(res, 403, { error: "Only the group owner can add members" });

    const { name, email } = await readJsonBody(req);
    if (!name || !name.trim()) return sendJson(res, 400, { error: "Name is required" });
    if (!isValidEmail(email)) return sendJson(res, 400, { error: "A valid email is required" });
    const normalizedEmail = email.trim().toLowerCase();

    // If this email already has an account (or a pending invite), link to
    // it rather than creating a duplicate; otherwise create a placeholder
    // account for them to claim by signing up with this same email.
    const { rows } = await db.query(
      `INSERT INTO users (name, email) VALUES ($1, $2)
       ON CONFLICT (email) DO UPDATE SET email = EXCLUDED.email
       RETURNING *`,
      [name.trim(), normalizedEmail]
    );
    const user = rows[0];

    await db.query("INSERT INTO group_members (group_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING", [
      groupId,
      user.id,
    ]);
    return sendJson(res, 201, {
      id: user.id,
      name: user.name,
      email: user.email,
      has_joined: Boolean(user.password_hash),
    });
  }

  res.setHeader("Allow", "GET, POST");
  return sendJson(res, 405, { error: "Method not allowed" });
}
