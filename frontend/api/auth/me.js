import { getPool, ensureSchema, sendJson } from "../_lib/db.js";
import { getSession } from "../_lib/auth.js";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return sendJson(res, 405, { error: "Method not allowed" });
  }

  const session = getSession(req);
  if (!session) return sendJson(res, 401, { error: "Not authenticated" });

  await ensureSchema();
  const db = getPool();
  // Re-fetch rather than trusting the token, in case admin status changed since it was issued.
  const { rows } = await db.query("SELECT * FROM users WHERE id = $1", [session.sub]);
  const user = rows[0];
  if (!user) return sendJson(res, 401, { error: "Not authenticated" });

  return sendJson(res, 200, { id: user.id, name: user.name, email: user.email, isAdmin: user.is_admin });
}
