import { getPool, ensureSchema, sendJson, readJsonBody } from "../_lib/db.js";
import { verifyPassword, signSession, setSessionCookie } from "../_lib/auth.js";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return sendJson(res, 405, { error: "Method not allowed" });
  }

  await ensureSchema();
  const db = getPool();
  const { email, password } = await readJsonBody(req);
  if (!email || !password) return sendJson(res, 400, { error: "Email and password are required" });

  const { rows } = await db.query("SELECT * FROM users WHERE email = $1", [String(email).trim().toLowerCase()]);
  const user = rows[0];

  const ok = user && (await verifyPassword(password, user.password_hash));
  if (!ok) return sendJson(res, 401, { error: "Invalid email or password" });

  const token = signSession(user);
  setSessionCookie(res, token);
  return sendJson(res, 200, { id: user.id, name: user.name, email: user.email, isAdmin: user.is_admin });
}
