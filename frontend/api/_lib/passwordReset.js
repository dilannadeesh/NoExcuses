import crypto from "node:crypto";
import { sendPasswordResetEmail } from "./email.js";

// The site's public base URL, used to build links in emails. APP_URL wins so
// links always point at the real domain, not a *.vercel.app preview host.
export function getBaseUrl(req) {
  if (process.env.APP_URL) return process.env.APP_URL.replace(/\/$/, "");
  const host = req.headers["x-forwarded-host"] || req.headers.host;
  const proto = req.headers["x-forwarded-proto"] || "https";
  return `${proto}://${host}`;
}

// Creates a single-use "set a new password" token and emails the link.
// Never throws: callers decide what to do when the email can't be sent
// (the admin screen shows the link so it can be shared by hand).
export async function sendResetLink(db, req, user, { hours = 1, byAdmin = false } = {}) {
  const token = crypto.randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + hours * 60 * 60 * 1000);
  await db.query("INSERT INTO password_reset_tokens (token, user_id, expires_at) VALUES ($1, $2, $3)", [
    token,
    user.id,
    expiresAt,
  ]);
  const resetUrl = `${getBaseUrl(req)}/reset-password?token=${token}`;
  try {
    await sendPasswordResetEmail({ to: user.email, name: user.name, resetUrl, hours, byAdmin });
    return { resetUrl, emailSent: true };
  } catch (e) {
    console.error("Failed to send password reset email:", e.message);
    return { resetUrl, emailSent: false, emailError: e.message };
  }
}
