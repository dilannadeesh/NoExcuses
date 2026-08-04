import { getPool, ensureSchema, sendJson, readJsonBody } from "../_lib/db.js";
import { hashPassword, signSession, setSessionCookie } from "../_lib/auth.js";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return sendJson(res, 405, { error: "Method not allowed" });
  }

  await ensureSchema();
  const db = getPool();
  const { token, password } = await readJsonBody(req);

  if (!token) return sendJson(res, 400, { error: "Missing reset token" });
  if (!password || password.length < 8) {
    return sendJson(res, 400, { error: "Password must be at least 8 characters" });
  }

  const client = await db.connect();
  try {
    await client.query("BEGIN");
    const { rows } = await client.query(
      `SELECT * FROM password_reset_tokens WHERE token = $1 AND used_at IS NULL AND expires_at > now() FOR UPDATE`,
      [token]
    );
    const resetRow = rows[0];
    if (!resetRow) {
      await client.query("ROLLBACK");
      return sendJson(res, 400, { error: "This reset link is invalid or has expired." });
    }

    const passwordHash = await hashPassword(password);
    const { rows: userRows } = await client.query(
      "UPDATE users SET password_hash = $1 WHERE id = $2 RETURNING *",
      [passwordHash, resetRow.user_id]
    );
    await client.query("UPDATE password_reset_tokens SET used_at = now() WHERE token = $1", [token]);
    await client.query("COMMIT");

    const user = userRows[0];
    const sessionToken = signSession(user);
    setSessionCookie(res, sessionToken);
    return sendJson(res, 200, { id: user.id, name: user.name, email: user.email, isAdmin: user.is_admin });
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}
