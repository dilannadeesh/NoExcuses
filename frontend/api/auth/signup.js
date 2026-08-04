import { getPool, ensureSchema, sendJson, readJsonBody } from "../_lib/db.js";
import { hashPassword, signSession, setSessionCookie, isValidEmail } from "../_lib/auth.js";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return sendJson(res, 405, { error: "Method not allowed" });
  }

  await ensureSchema();
  const db = getPool();
  const { name, email, password } = await readJsonBody(req);

  if (!name || !name.trim()) return sendJson(res, 400, { error: "Name is required" });
  if (!isValidEmail(email)) return sendJson(res, 400, { error: "A valid email is required" });
  if (!password || password.length < 8) {
    return sendJson(res, 400, { error: "Password must be at least 8 characters" });
  }

  const normalizedEmail = email.trim().toLowerCase();
  const client = await db.connect();
  try {
    await client.query("BEGIN");

    const { rows: existingRows } = await client.query(
      "SELECT * FROM users WHERE email = $1 FOR UPDATE",
      [normalizedEmail]
    );
    const existing = existingRows[0];

    if (existing && existing.password_hash) {
      await client.query("ROLLBACK");
      return sendJson(res, 409, { error: "An account with this email already exists. Try logging in." });
    }

    // First real (password-holding) signup becomes the admin.
    const { rows: adminCheck } = await client.query(
      "SELECT COUNT(*)::int AS n FROM users WHERE password_hash IS NOT NULL"
    );
    const isFirstUser = adminCheck[0].n === 0;
    const passwordHash = await hashPassword(password);

    let user;
    if (existing) {
      // Claiming a placeholder account created by a group owner's invite.
      const { rows } = await client.query(
        "UPDATE users SET name = $1, password_hash = $2, is_admin = is_admin OR $3 WHERE id = $4 RETURNING *",
        [name.trim(), passwordHash, isFirstUser, existing.id]
      );
      user = rows[0];
    } else {
      const { rows } = await client.query(
        "INSERT INTO users (name, email, password_hash, is_admin) VALUES ($1, $2, $3, $4) RETURNING *",
        [name.trim(), normalizedEmail, passwordHash, isFirstUser]
      );
      user = rows[0];
    }

    await client.query("COMMIT");

    const token = signSession(user);
    setSessionCookie(res, token);
    return sendJson(res, 201, { id: user.id, name: user.name, email: user.email, isAdmin: user.is_admin });
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}
