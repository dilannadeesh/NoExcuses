import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import * as cookie from "cookie";
import { sendJson, getPool, ensureSchema } from "./db.js";

const COOKIE_NAME = "session";
const SESSION_DAYS = 30;

function getSecret() {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error("JWT_SECRET env var is not set.");
  return secret;
}

export function hashPassword(password) {
  return bcrypt.hash(password, 10);
}

export function verifyPassword(password, hash) {
  if (!hash) return Promise.resolve(false);
  return bcrypt.compare(password, hash);
}

export function signSession(user) {
  return jwt.sign(
    { sub: user.id, email: user.email, name: user.name, isAdmin: user.is_admin },
    getSecret(),
    { expiresIn: `${SESSION_DAYS}d` }
  );
}

// Vercel sets VERCEL_ENV in every deployed environment (production/preview);
// it's unset when running purely locally without `vercel dev`/env pull.
const isDeployed = () => Boolean(process.env.VERCEL_ENV);

export function setSessionCookie(res, token) {
  res.setHeader(
    "Set-Cookie",
    cookie.serialize(COOKIE_NAME, token, {
      httpOnly: true,
      secure: isDeployed(),
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * SESSION_DAYS,
    })
  );
}

export function clearSessionCookie(res) {
  res.setHeader(
    "Set-Cookie",
    cookie.serialize(COOKIE_NAME, "", {
      httpOnly: true,
      secure: isDeployed(),
      sameSite: "lax",
      path: "/",
      maxAge: 0,
    })
  );
}

// Returns { sub, email, name, isAdmin } or null. Never throws.
export function getSession(req) {
  const header = req.headers.cookie;
  if (!header) return null;
  const token = cookie.parse(header)[COOKIE_NAME];
  if (!token) return null;
  try {
    return jwt.verify(token, getSecret());
  } catch {
    return null;
  }
}

// A valid signature isn't enough: the token lives up to 30 days, so it can
// outlast the account being deactivated or deleted. Every authenticated
// request re-checks the database -- that's what makes deactivation take effect
// on the very next request instead of whenever the token happens to expire.
// Returns { session } when fine, or { error } describing why not.
async function checkSessionAgainstDb(req) {
  const session = getSession(req);
  if (!session) return { error: "Not authenticated" };
  // Must run before touching users.is_active: on the first request after a
  // deploy the migration that adds that column may not have run yet.
  await ensureSchema();
  const { rows } = await getPool().query("SELECT is_active FROM users WHERE id = $1", [session.sub]);
  if (!rows[0]) return { error: "Not authenticated" };
  if (!rows[0].is_active) return { error: "This account has been deactivated." };
  return { session };
}

// Call at the top of a handler (with await). Returns the session, or sends a
// 401 and returns null (caller should just `return` in that case).
export async function requireAuth(req, res) {
  const { session, error } = await checkSessionAgainstDb(req);
  if (!session) {
    sendJson(res, 401, { error });
    return null;
  }
  return session;
}

// For handlers that do their own response handling (e.g. the public-or-private
// tournament route): same checks, but returns null instead of responding.
export async function getActiveSession(req) {
  const { session } = await checkSessionAgainstDb(req);
  return session || null;
}

// Like requireAuth, but also re-checks is_admin against the database rather
// than trusting the JWT's claim -- important here specifically, since an
// admin could demote another admin (or themselves) through this very panel,
// and a stale token shouldn't keep granting admin powers until it expires.
export async function requireAdmin(req, res, db) {
  const session = await requireAuth(req, res);
  if (!session) return null;
  if (!(await isCurrentlyAdmin(db, session.sub))) {
    sendJson(res, 403, { error: "Admin access required" });
    return null;
  }
  return session;
}

// Session tokens last up to 30 days and bake in isAdmin at login time, so
// session.isAdmin can go stale the moment anyone's admin status changes --
// promoted, demoted, or self-demoted. Anywhere admin status gates real
// access (not just this file) should call this instead of trusting the
// token's claim directly.
export async function isCurrentlyAdmin(db, userId) {
  const { rows } = await db.query("SELECT is_admin, is_active FROM users WHERE id = $1", [userId]);
  // A deactivated admin has no admin powers either.
  return Boolean(rows[0]?.is_admin && rows[0]?.is_active);
}

export const isValidEmail = (email) =>
  typeof email === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
