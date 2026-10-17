// Numbers for the super-admin Analytics tab that come from our own database:
// who signed up on which platform, and who used the app on which platform on
// which day (platform_activity, written by recordActivity on every signed-in
// request). Works with or without Google Analytics.
import { ANALYTICS_TZ } from "./activity.js";

const PLATFORMS = ["ios_app", "android_app", "web"];
export const RANGES = [7, 28, 90];

const empty = () => ({
  signups: 0,
  active1: 0,
  active7: 0,
  active30: 0,
  activeInRange: 0,
  newInRange: 0,
  returningInRange: 0,
  pushDevices: 0,
});

export async function dbDashboard(db, days) {
  const tz = ANALYTICS_TZ();
  const todayRow = await db.query("SELECT to_char((now() AT TIME ZONE $1)::date, 'YYYY-MM-DD') AS today", [tz]);
  const today = new Date(`${todayRow.rows[0].today}T00:00:00Z`); // that calendar day, as UTC midnight
  const iso = (d) => d.toISOString().slice(0, 10);
  const addDays = (d, n) => new Date(d.getTime() + n * 86400000);
  const to = iso(today);
  const from = iso(addDays(today, -(days - 1)));

  const platforms = Object.fromEntries(PLATFORMS.map((p) => [p, empty()]));
  const put = (rows, field) => {
    for (const r of rows) if (platforms[r.platform]) platforms[r.platform][field] = r.n;
  };

  const [signups, active, inRange, firstSeen, push, daily, totals, multi, since] = await Promise.all([
    db.query(
      `SELECT COALESCE(signup_platform, 'unknown') AS platform, COUNT(*)::int AS n
       FROM users WHERE password_hash IS NOT NULL GROUP BY 1`
    ),
    db.query(
      `SELECT platform,
         COUNT(DISTINCT user_id) FILTER (WHERE day = $1::date)::int AS a1,
         COUNT(DISTINCT user_id) FILTER (WHERE day > $1::date - 7)::int AS a7,
         COUNT(DISTINCT user_id) FILTER (WHERE day > $1::date - 30)::int AS a30
       FROM platform_activity WHERE day > $1::date - 30 GROUP BY platform`,
      [to]
    ),
    db.query(
      `SELECT platform, COUNT(*)::int AS n,
         COUNT(*) FILTER (WHERE active_days >= 2)::int AS returning
       FROM (SELECT user_id, platform, COUNT(*) AS active_days
             FROM platform_activity WHERE day BETWEEN $1 AND $2 GROUP BY user_id, platform) t
       GROUP BY platform`,
      [from, to]
    ),
    // A person is "new" on the day we first saw them, on the platform they used that day.
    db.query(
      `SELECT DISTINCT ON (user_id) user_id, platform, to_char(day, 'YYYY-MM-DD') AS day
       FROM platform_activity ORDER BY user_id, platform_activity.day, platform`
    ),
    db.query("SELECT platform, COUNT(DISTINCT user_id)::int AS n FROM push_tokens GROUP BY platform"),
    db.query(
      `SELECT to_char(day, 'YYYY-MM-DD') AS day, platform, COUNT(DISTINCT user_id)::int AS n
       FROM platform_activity WHERE day BETWEEN $1 AND $2 GROUP BY day, platform`,
      [from, to]
    ),
    db.query(
      `SELECT
         (SELECT COUNT(*)::int FROM users WHERE password_hash IS NOT NULL) AS users,
         (SELECT COUNT(*)::int FROM groups) AS groups,
         (SELECT COUNT(*)::int FROM games) AS games,
         (SELECT COUNT(*)::int FROM games WHERE (created_at AT TIME ZONE $3)::date BETWEEN $1 AND $2) AS games_in_range,
         (SELECT COUNT(*)::int FROM groups WHERE (created_at AT TIME ZONE $3)::date BETWEEN $1 AND $2) AS groups_in_range`,
      [from, to, tz]
    ),
    db.query(
      `SELECT COUNT(*)::int AS n FROM (
         SELECT user_id FROM platform_activity WHERE day BETWEEN $1 AND $2
         GROUP BY user_id HAVING COUNT(DISTINCT platform) > 1) t`,
      [from, to]
    ),
    db.query("SELECT to_char(MIN(day), 'YYYY-MM-DD') AS d FROM platform_activity"),
  ]);

  let unknownSignups = 0;
  for (const r of signups.rows) {
    if (r.platform === "unknown") unknownSignups = r.n;
    else if (platforms[r.platform]) platforms[r.platform].signups = r.n;
  }
  for (const r of active.rows) {
    if (!platforms[r.platform]) continue;
    Object.assign(platforms[r.platform], { active1: r.a1, active7: r.a7, active30: r.a30 });
  }
  for (const r of inRange.rows) {
    if (!platforms[r.platform]) continue;
    Object.assign(platforms[r.platform], { activeInRange: r.n, returningInRange: r.returning });
  }
  for (const r of firstSeen.rows) {
    const d = r.day;
    if (d >= from && d <= to && platforms[r.platform]) platforms[r.platform].newInRange += 1;
  }
  // push_tokens says 'ios' / 'android'
  put(
    push.rows.map((r) => ({ platform: `${r.platform}_app`, n: r.n })),
    "pushDevices"
  );

  const dayMap = new Map();
  for (let i = 0; i < days; i++) {
    const day = iso(addDays(today, -(days - 1) + i));
    dayMap.set(day, { day, ios_app: 0, android_app: 0, web: 0 });
  }
  for (const r of daily.rows) {
    const row = dayMap.get(r.day);
    if (row && r.platform in row) row[r.platform] = r.n;
  }

  const t = totals.rows[0];
  return {
    range: { days, from, to, timezone: tz },
    trackingSince: since.rows[0].d,
    platforms,
    unknownSignups,
    multiPlatformUsers: multi.rows[0].n,
    daily: [...dayMap.values()],
    totals: {
      users: t.users,
      groups: t.groups,
      games: t.games,
      gamesInRange: t.games_in_range,
      groupsInRange: t.groups_in_range,
    },
  };
}
