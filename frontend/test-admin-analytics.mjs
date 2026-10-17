// Admin Analytics tab: platform tracking + /api/admin/analytics (real Postgres)
// and the GA4 Data API client (mocked fetch -- no network).
// Run: npm run test:admin-analytics   (needs the same local Postgres as test-harness.mjs)
process.env.DATABASE_URL = "postgresql://postgres:testpass@localhost:5432/scoremine_test";
process.env.JWT_SECRET = "test-secret-not-for-production";
process.env.ANALYTICS_TIMEZONE = "Asia/Singapore";
delete process.env.RESEND_API_KEY;
delete process.env.GA_PROPERTY_ID;
delete process.env.GA_SERVICE_ACCOUNT_JSON;

import crypto from "node:crypto";
import authHandler from "./api/auth/[action].js";
import adminHandler from "./api/admin/[...path].js";
import meHandler from "./api/me.js";
import { getPool } from "./api/_lib/db.js";
import { platformFromRequest } from "./src/lib/platform.js";
import { gaCredentials, makeGoogleJwt, fetchGaDashboard, _resetGaCaches } from "./api/_lib/ga4.js";

let failures = 0;
const assert = (cond, msg) => {
  if (!cond) {
    failures++;
    console.error("FAIL:", msg);
  } else console.log("ok:", msg);
};

async function call(handler, { method = "GET", query = {}, body, cookie, headers = {}, url } = {}) {
  const req = { method, query, body, url, headers: { ...headers, ...(cookie ? { cookie } : {}) } };
  const res = {
    statusCode: 200,
    headers: {},
    body: undefined,
    status(c) { this.statusCode = c; return this; },
    setHeader(k, v) { this.headers[k] = v; return this; },
    send(p) { this.body = p; return this; },
    end() { return this; },
  };
  await handler(req, res);
  let parsed = res.body;
  try { parsed = res.body ? JSON.parse(res.body) : undefined; } catch { /* not json */ }
  const m = String(res.headers["Set-Cookie"] || "").match(/session=([^;]+)/);
  return { status: res.statusCode, body: parsed, cookie: m ? `session=${m[1]}` : null };
}

const IOS_UA = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148";
const ANDROID_UA = "Mozilla/5.0 (Linux; Android 14; Pixel 8 Build/AP1A; wv) AppleWebKit/537.36 Chrome/120 Mobile Safari/537.36";

const run = async () => {
  const db = getPool();
  await db.query("DROP SCHEMA public CASCADE; CREATE SCHEMA public;");

  // --- platformFromRequest ---
  assert(platformFromRequest({ "x-client-platform": "ios_app" }) === "ios_app", "header ios_app is trusted");
  assert(platformFromRequest({ "x-client-platform": "evil" , "user-agent": ANDROID_UA }) === "android_app", "bad header falls back to UA sniffing");
  assert(platformFromRequest({ "user-agent": IOS_UA }) === "ios_app", "iOS WKWebView UA -> ios_app");
  assert(platformFromRequest({}) === "web", "no info -> web");

  // --- signups record their platform ---
  const signup = (name, email, headers) =>
    call(authHandler, { method: "POST", query: { action: "signup" }, url: "/api/auth/signup", body: { name, email, password: "correcthorse1" }, headers });
  let r = await signup("Admin", "admin@example.com", { "x-client-platform": "web" });
  assert(r.status === 201 && r.body.isAdmin, "first signup (web) is admin");
  const adminCookie = r.cookie;
  r = await signup("Ivy", "ivy@example.com", { "x-client-platform": "ios_app" });
  const ivyCookie = r.cookie;
  r = await signup("Ari", "ari@example.com", { "user-agent": ANDROID_UA });
  const ariCookie = r.cookie;
  r = await signup("Ian", "ian@example.com", { "x-client-platform": "ios_app" });
  assert(r.status === 201, "more signups work");

  const { rows: sp } = await db.query("SELECT email, signup_platform FROM users ORDER BY id");
  assert(sp.map((x) => x.signup_platform).join() === "web,ios_app,android_app,ios_app", `signup_platform stored (${sp.map((x) => x.signup_platform)})`);

  // --- signed-in requests record daily activity ---
  r = await call(meHandler, { cookie: ariCookie, headers: { "x-client-platform": "android_app" } });
  assert(r.status === 200, "a normal signed-in request still works");
  r = await call(meHandler, { cookie: ivyCookie, headers: { "x-client-platform": "web" } }); // Ivy also uses the website
  const { rows: act } = await db.query("SELECT u.name, a.platform FROM platform_activity a JOIN users u ON u.id = a.user_id ORDER BY 1, 2");
  const actStr = act.map((a) => `${a.name}:${a.platform}`).join(",");
  assert(actStr.includes("Ivy:ios_app") && actStr.includes("Ivy:web") && actStr.includes("Ari:android_app"), `activity rows written (${actStr})`);

  // Past activity: Ivy came back on iOS 3 and 10 days ago; Ari 40 days ago only.
  const ids = Object.fromEntries((await db.query("SELECT id, name FROM users")).rows.map((u) => [u.name, u.id]));
  await db.query(
    `INSERT INTO platform_activity (user_id, platform, day) VALUES
       ($1, 'ios_app', (now() AT TIME ZONE 'Asia/Singapore')::date - 3),
       ($1, 'ios_app', (now() AT TIME ZONE 'Asia/Singapore')::date - 10),
       ($2, 'android_app', (now() AT TIME ZONE 'Asia/Singapore')::date - 40)`,
    [ids.Ivy, ids.Ari]
  );
  await db.query("INSERT INTO push_tokens (token, user_id, platform) VALUES ('t1', $1, 'ios'), ('t2', $2, 'android')", [ids.Ivy, ids.Ari]);

  // --- the endpoint ---
  r = await call(adminHandler, { query: { path: ["analytics"], days: "28" }, url: "/api/admin/analytics?days=28", cookie: ivyCookie });
  assert(r.status === 403, "non-admin is refused");

  r = await call(adminHandler, { query: { path: ["analytics"], days: "28" }, url: "/api/admin/analytics?days=28", cookie: adminCookie });
  assert(r.status === 200, `admin gets analytics (${r.status} ${JSON.stringify(r.body).slice(0, 200)})`);
  const a = r.body;
  const P = a.platforms;
  assert(a.range.days === 28 && a.daily.length === 28, "28-day range with one row per day");
  assert(P.ios_app.signups === 2 && P.android_app.signups === 1 && P.web.signups === 1, "signups by platform");
  assert(P.ios_app.active1 === 2 && P.android_app.active1 === 1, `active today (ios ${P.ios_app.active1}, android ${P.android_app.active1})`);
  assert(P.ios_app.activeInRange === 2, "Ivy + Ian active on iOS in 28 days");
  assert(P.ios_app.returningInRange === 1, "only Ivy came back on 2+ days on iOS");
  assert(P.android_app.active30 === 1 && P.android_app.newInRange === 0, "Ari first seen 40 days ago is not new in range");
  assert(P.ios_app.newInRange === 2, "Ivy (10 days ago) and Ian (today) are new on iOS");
  assert(P.ios_app.pushDevices === 1 && P.android_app.pushDevices === 1, "push devices by platform");
  assert(a.multiPlatformUsers === 1, "Ivy used two platforms");
  assert(a.daily[a.daily.length - 1].ios_app === 2, "today's iOS count in the daily series");
  assert(a.daily[a.daily.length - 4].ios_app === 1, "3 days ago: Ivy on iOS");
  assert(a.totals.users === 4, "total joined users");
  assert(a.ga && a.ga.configured === false && a.ga.missing.includes("GA_PROPERTY_ID"), "GA reported as not configured");

  r = await call(adminHandler, { query: { path: ["analytics"], days: "7" }, url: "/api/admin/analytics?days=7", cookie: adminCookie });
  assert(r.body.daily.length === 7 && r.body.platforms.ios_app.newInRange === 1, "7-day range: only Ian is new on iOS");
  r = await call(adminHandler, { query: { path: ["analytics"], days: "999" }, url: "/api/admin/analytics?days=999", cookie: adminCookie });
  assert(r.body.range.days === 28, "unknown range falls back to 28 days");

  // --- GA4 client (mocked) ---
  const { privateKey, publicKey } = crypto.generateKeyPairSync("rsa", { modulusLength: 2048 });
  const pem = privateKey.export({ type: "pkcs8", format: "pem" });
  const env = {
    GA_PROPERTY_ID: "412345678",
    GA_SERVICE_ACCOUNT_JSON: JSON.stringify({ client_email: "dash@proj.iam.gserviceaccount.com", private_key: pem }),
  };
  assert(gaCredentials({ GA_PROPERTY_ID: "G-ABC123", GA_SERVICE_ACCOUNT_JSON: env.GA_SERVICE_ACCOUNT_JSON }).problem?.includes("numeric"), "G- id is rejected with a helpful message");
  assert(gaCredentials({ ...env, GA_SERVICE_ACCOUNT_JSON: "{oops" }).problem?.includes("valid JSON"), "broken key JSON is explained");

  const jwt = makeGoogleJwt(gaCredentials(env));
  const [h, b, s] = jwt.split(".");
  assert(crypto.verify("sha256", Buffer.from(`${h}.${b}`), publicKey, Buffer.from(s, "base64url")), "service-account JWT is RS256-signed correctly");
  assert(JSON.parse(Buffer.from(b, "base64url")).scope.endsWith("analytics.readonly"), "JWT asks for read-only analytics");

  const rep = (rows) => ({ rows: rows.map(([dims, mets]) => ({ dimensionValues: dims.map((value) => ({ value })), metricValues: mets.map((v) => ({ value: String(v) })) })) });
  const calls = [];
  const fakeFetch = async (url, init) => {
    calls.push({ url, body: init.body });
    if (url.includes("oauth2")) return { ok: true, status: 200, json: async () => ({ access_token: "tok", expires_in: 3600 }) };
    const reqs = JSON.parse(init.body).requests;
    if (reqs.length === 1) return { ok: true, status: 200, json: async () => ({ reports: [rep([[["iOS"], [12]], [["Android"], [9]]])] }) };
    return {
      ok: true,
      status: 200,
      json: async () => ({
        reports: [
          rep([[["ios_app"], [12, 5, 30, 24, 3600, 200]], [["android_app"], [9, 2, 20, 10, 900, 90]], [["(not set)"], [4, 4, 4, 1, 40, 8]]]),
          rep([[["20261016", "ios_app"], [7]], [["20261017", "ios_app"], [8]], [["20261017", "android_app"], [5]]]),
          rep([[["game_logged", "ios_app"], [40]], [["game_logged", "android_app"], [11]], [["api_error", "android_app"], [3]]]),
          rep([[["/groups/:id", "ios_app"], [120]], [["/groups/:id/log", "android_app"], [30]]]),
        ],
      }),
    };
  };
  _resetGaCaches();
  const ga = await fetchGaDashboard(28, { env, fetchImpl: fakeFetch });
  assert(ga.configured && !ga.error, `GA dashboard fetched (${ga.error || "ok"})`);
  assert(ga.byPlatform.ios_app.activeUsers === 12 && ga.byPlatform.not_set.activeUsers === 4, "GA users by platform, (not set) kept separate");
  assert(Math.abs(ga.byPlatform.ios_app.engagementRate - 0.8) < 1e-9, "engagement rate = engaged / sessions");
  assert(ga.byPlatform.ios_app.avgEngagementSecondsPerUser === 300, "avg engagement time per user");
  assert(ga.daily.length === 2 && ga.daily[1].day === "2026-10-17" && ga.daily[1].android_app === 5, "GA daily series by platform");
  assert(ga.events[0].name === "game_logged" && ga.events[0].ios_app === 40, "key events in fixed order");
  assert(ga.screens[0].path === "/groups/:id", "top screens sorted");
  assert(ga.os[0].os === "iOS", "operating-system breakdown");
  const mainReq = JSON.parse(calls.find((c) => c.url.includes("batchRunReports") && JSON.parse(c.body).requests.length === 4).body);
  assert(mainReq.requests[0].dateRanges[0].startDate === "27daysAgo", "28 days = 27daysAgo..today");
  assert(calls.some((c) => c.url.includes("properties/412345678:batchRunReports")), "queries the right property");

  // Cached: a second call within 10 min doesn't hit Google again.
  const before = calls.length;
  await fetchGaDashboard(28, { env, fetchImpl: fakeFetch });
  assert(calls.length === before, "GA responses are cached");

  // Custom dimension missing: still returns the OS report plus a hint.
  _resetGaCaches();
  const failingFetch = async (url, init) => {
    if (url.includes("oauth2")) return { ok: true, status: 200, json: async () => ({ access_token: "tok", expires_in: 3600 }) };
    if (JSON.parse(init.body).requests.length === 1) return fakeFetch(url, init);
    return { ok: false, status: 400, json: async () => ({ error: { message: "Field customUser:platform is not a valid dimension." } }) };
  };
  const ga2 = await fetchGaDashboard(28, { env, fetchImpl: failingFetch });
  assert(ga2.error && ga2.hint?.includes("custom dimension") && ga2.os.length === 2, "unregistered `platform` dimension -> hint + OS data still shown");

  // Bad credentials: clear message.
  _resetGaCaches();
  const ga3 = await fetchGaDashboard(7, {
    env,
    fetchImpl: async () => ({ ok: false, status: 400, json: async () => ({ error: "invalid_grant", error_description: "Invalid JWT Signature." }) }),
  });
  assert(ga3.error?.includes("Invalid JWT Signature"), "Google sign-in errors are surfaced");

  console.log(failures === 0 ? "\nALL PASSED" : `\n${failures} FAILURE(S)`);
  await db.end();
  process.exit(failures ? 1 : 0);
};

run().catch((e) => {
  console.error("Unhandled error:", e);
  process.exit(1);
});
