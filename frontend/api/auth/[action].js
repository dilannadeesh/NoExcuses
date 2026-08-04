import crypto from "node:crypto";
import { getPool, ensureSchema, sendJson, readJsonBody } from "../_lib/db.js";
import {
  hashPassword,
  verifyPassword,
  signSession,
  setSessionCookie,
  clearSessionCookie,
  getSession,
  isValidEmail,
} from "../_lib/auth.js";
import { sendPasswordResetEmail } from "../_lib/email.js";

const RESET_TOKEN_TTL_MS = 60 * 60 * 1000; // 1 hour

function getBaseUrl(req) {
  if (process.env.APP_URL) return process.env.APP_URL.replace(/\/$/, "");
  const host = req.headers["x-forwarded-host"] || req.headers.host;
  const proto = req.headers["x-forwarded-proto"] || "https";
  return `${proto}://${host}`;
}

async function signup(req, res, db) {
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
    const { rows: existingRows } = await client.query("SELECT * FROM users WHERE email = $1 FOR UPDATE", [
      normalizedEmail,
    ]);
    const existing = existingRows[0];

    if (existing && existing.password_hash) {
      await client.query("ROLLBACK");
      return sendJson(res, 409, { error: "An account with this email already exists. Try logging in." });
    }

    const { rows: adminCheck } = await client.query(
      "SELECT COUNT(*)::int AS n FROM users WHERE password_hash IS NOT NULL"
    );
    const isFirstUser = adminCheck[0].n === 0;
    const passwordHash = await hashPassword(password);

    let user;
    if (existing) {
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

async function login(req, res, db) {
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

async function logout(req, res) {
  clearSessionCookie(res);
  return res.status(204).end();
}

async function me(req, res, db) {
  const session = getSession(req);
  if (!session) return sendJson(res, 401, { error: "Not authenticated" });
  const { rows } = await db.query("SELECT * FROM users WHERE id = $1", [session.sub]);
  const user = rows[0];
  if (!user) return sendJson(res, 401, { error: "Not authenticated" });
  return sendJson(res, 200, { id: user.id, name: user.name, email: user.email, isAdmin: user.is_admin });
}

async function forgotPassword(req, res, db) {
  const { email } = await readJsonBody(req);
  const genericResponse = { message: "If that email has an account, we've sent a password reset link." };
  if (!isValidEmail(email)) return sendJson(res, 200, genericResponse);

  const { rows } = await db.query("SELECT * FROM users WHERE email = $1 AND password_hash IS NOT NULL", [
    String(email).trim().toLowerCase(),
  ]);
  const user = rows[0];
  if (!user) return sendJson(res, 200, genericResponse);

  const token = crypto.randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + RESET_TOKEN_TTL_MS);
  await db.query("INSERT INTO password_reset_tokens (token, user_id, expires_at) VALUES ($1, $2, $3)", [
    token,
    user.id,
    expiresAt,
  ]);

  const resetUrl = `${getBaseUrl(req)}/reset-password?token=${token}`;
  try {
    await sendPasswordResetEmail({ to: user.email, resetUrl });
  } catch (e) {
    console.error("Failed to send password reset email:", e.message);
  }
  return sendJson(res, 200, genericResponse);
}

async function resetPassword(req, res, db) {
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
    const { rows: userRows } = await client.query("UPDATE users SET password_hash = $1 WHERE id = $2 RETURNING *", [
      passwordHash,
      resetRow.user_id,
    ]);
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

const ROUTES = {
  signup: { method: "POST", fn: signup },
  login: { method: "POST", fn: login },
  logout: { method: "POST", fn: logout },
  me: { method: "GET", fn: me },
  "forgot-password": { method: "POST", fn: forgotPassword },
  "reset-password": { method: "POST", fn: resetPassword },
};

export default async function handler(req, res) {
  const { action } = req.query;
  const route = ROUTES[action];
  if (!route) return sendJson(res, 404, { error: "Not found" });
  if (req.method !== route.method) {
    res.setHeader("Allow", route.method);
    return sendJson(res, 405, { error: "Method not allowed" });
  }

  await ensureSchema();
  const db = getPool();
  return route.fn(req, res, db);
}
