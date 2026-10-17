import { getPool } from "./db.js";
import { platformFromRequest } from "../../src/lib/platform.js";

// Days are counted in the app's home time zone, not UTC, so "today" on the
// dashboard matches the evening the games were actually played.
export const ANALYTICS_TZ = () => process.env.ANALYTICS_TIMEZONE || "Asia/Singapore";

// One cheap upsert per person per platform per day. A warm serverless instance
// remembers what it already wrote, so most requests skip the database.
const seen = new Set();

export async function recordActivity(req, userId, db = getPool()) {
  try {
    const platform = platformFromRequest(req.headers || {});
    const day = new Date().toLocaleDateString("en-CA", { timeZone: ANALYTICS_TZ() }); // YYYY-MM-DD
    const key = `${userId}:${platform}:${day}`;
    if (seen.has(key)) return;
    await db.query(
      "INSERT INTO platform_activity (user_id, platform, day) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING",
      [userId, platform, day]
    );
    if (seen.size > 5000) seen.clear();
    seen.add(key);
  } catch {
    // Analytics must never break a real request.
  }
}
