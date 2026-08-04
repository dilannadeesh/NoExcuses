import crypto from "node:crypto";
import { getPool, ensureSchema, sendJson, readJsonBody } from "../_lib/db.js";
import { isValidEmail } from "../_lib/auth.js";
import { sendPasswordResetEmail } from "../_lib/email.js";

const TOKEN_TTL_MS = 60 * 60 * 1000; // 1 hour

function getBaseUrl(req) {
  if (process.env.APP_URL) return process.env.APP_URL.replace(/\/$/, "");
  const host = req.headers["x-forwarded-host"] || req.headers.host;
  const proto = req.headers["x-forwarded-proto"] || "https";
  return `${proto}://${host}`;
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return sendJson(res, 405, { error: "Method not allowed" });
  }

  await ensureSchema();
  const db = getPool();
  const { email } = await readJsonBody(req);

  // Always return the same generic response, whether or not the email
  // exists, so this endpoint can't be used to enumerate registered emails.
  const genericResponse = { message: "If that email has an account, we've sent a password reset link." };

  if (!isValidEmail(email)) return sendJson(res, 200, genericResponse);

  const { rows } = await db.query(
    "SELECT * FROM users WHERE email = $1 AND password_hash IS NOT NULL",
    [String(email).trim().toLowerCase()]
  );
  const user = rows[0];
  if (!user) return sendJson(res, 200, genericResponse);

  const token = crypto.randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + TOKEN_TTL_MS);
  await db.query("INSERT INTO password_reset_tokens (token, user_id, expires_at) VALUES ($1, $2, $3)", [
    token,
    user.id,
    expiresAt,
  ]);

  const resetUrl = `${getBaseUrl(req)}/reset-password?token=${token}`;

  try {
    await sendPasswordResetEmail({ to: user.email, resetUrl });
  } catch (e) {
    // Don't leak delivery failures to the client (still avoid enumeration),
    // but surface it in logs for debugging (e.g. Resend sandbox restrictions).
    console.error("Failed to send password reset email:", e.message);
  }

  return sendJson(res, 200, genericResponse);
}
