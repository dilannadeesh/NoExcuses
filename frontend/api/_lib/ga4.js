// Google Analytics 4 Data API, read-only, for the admin Analytics tab.
//
// Uses a Google Cloud service account (no SDK -- the OAuth JWT is signed with
// node:crypto). Configure on Vercel:
//   GA_PROPERTY_ID           numeric GA4 property id, e.g. 412345678 (not the G- id)
//   GA_SERVICE_ACCOUNT_JSON  the whole service-account key file, pasted as one value
// (or GA_CLIENT_EMAIL + GA_PRIVATE_KEY instead of the JSON). The service
// account's email must be added in GA -> Admin -> Property access management
// with the Viewer role. See ANALYTICS.md section 5.
import crypto from "node:crypto";

const SCOPE = "https://www.googleapis.com/auth/analytics.readonly";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const API = "https://analyticsdata.googleapis.com/v1beta";

export const PLATFORM_DIM = "customUser:platform";
export const KEY_EVENTS = [
  "sign_up",
  "login",
  "group_created",
  "member_added",
  "game_logged",
  "tournament_created",
  "schedule_saved",
  "schedule_shared",
  "ui_error",
  "api_error",
  "js_error",
  "api_slow",
];

const b64url = (input) => Buffer.from(input).toString("base64url");

export function gaCredentials(env = process.env) {
  const propertyId = String(env.GA_PROPERTY_ID || "").replace(/^properties\//, "").trim();
  let clientEmail = env.GA_CLIENT_EMAIL;
  let privateKey = env.GA_PRIVATE_KEY;
  if (env.GA_SERVICE_ACCOUNT_JSON) {
    try {
      const j = JSON.parse(env.GA_SERVICE_ACCOUNT_JSON);
      clientEmail = clientEmail || j.client_email;
      privateKey = privateKey || j.private_key;
    } catch {
      return { configured: false, problem: "GA_SERVICE_ACCOUNT_JSON is not valid JSON -- paste the whole key file." };
    }
  }
  const missing = [];
  if (!propertyId) missing.push("GA_PROPERTY_ID");
  if (!clientEmail || !privateKey) missing.push("GA_SERVICE_ACCOUNT_JSON");
  if (missing.length) return { configured: false, missing };
  if (!/^\d+$/.test(propertyId)) {
    return { configured: false, problem: "GA_PROPERTY_ID must be the numeric property id (Admin -> Property details), not the G- measurement id." };
  }
  return { configured: true, propertyId, clientEmail, privateKey: privateKey.replace(/\\n/g, "\n") };
}

export function makeGoogleJwt({ clientEmail, privateKey }, now = Date.now()) {
  const iat = Math.floor(now / 1000);
  const head = b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const body = b64url(JSON.stringify({ iss: clientEmail, scope: SCOPE, aud: TOKEN_URL, iat, exp: iat + 3600 }));
  const sig = crypto.sign("sha256", Buffer.from(`${head}.${body}`), privateKey);
  return `${head}.${body}.${b64url(sig)}`;
}

let tokenCache = { token: null, exp: 0, who: null };

async function accessToken(creds, fetchImpl) {
  const now = Date.now();
  if (tokenCache.token && tokenCache.who === creds.clientEmail && now < tokenCache.exp - 60_000) return tokenCache.token;
  const res = await fetchImpl(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: makeGoogleJwt(creds, now),
    }).toString(),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || !json.access_token) {
    throw new Error(`Google sign-in failed (${res.status}): ${json.error_description || json.error || "no token"}`);
  }
  tokenCache = { token: json.access_token, exp: now + (json.expires_in || 3600) * 1000, who: creds.clientEmail };
  return json.access_token;
}

async function batchRun(creds, requests, fetchImpl) {
  const token = await accessToken(creds, fetchImpl);
  const res = await fetchImpl(`${API}/properties/${creds.propertyId}:batchRunReports`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ requests }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error?.message || `GA request failed (${res.status})`);
  return json.reports || [];
}

// GA rows -> [{ dims: [...], mets: [...] }] with numbers parsed.
export function rowsOf(report) {
  return (report?.rows || []).map((r) => ({
    dims: (r.dimensionValues || []).map((d) => d.value),
    mets: (r.metricValues || []).map((m) => Number(m.value) || 0),
  }));
}

// Whatever the platform user property says ("ios_app", "(not set)", ...).
// Visits from before the app version that sets it show as "(not set)".
export const normPlatform = (v) => (["ios_app", "android_app", "web"].includes(v) ? v : "not_set");

export function shapeGaReports([summary, daily, events, screens], osReport) {
  const SUMMARY_METRICS = ["activeUsers", "newUsers", "sessions", "engagedSessions", "userEngagementDuration", "screenPageViews"];
  const byPlatform = {};
  for (const { dims, mets } of rowsOf(summary)) {
    const p = normPlatform(dims[0]);
    const cur = byPlatform[p] || Object.fromEntries(SUMMARY_METRICS.map((m) => [m, 0]));
    SUMMARY_METRICS.forEach((m, i) => (cur[m] += mets[i]));
    byPlatform[p] = cur;
  }
  for (const v of Object.values(byPlatform)) {
    v.engagementRate = v.sessions ? v.engagedSessions / v.sessions : 0;
    v.avgEngagementSecondsPerUser = v.activeUsers ? v.userEngagementDuration / v.activeUsers : 0;
  }

  const dayMap = new Map();
  for (const { dims, mets } of rowsOf(daily)) {
    const d = dims[0]; // YYYYMMDD
    const day = `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}`;
    const row = dayMap.get(day) || { day, ios_app: 0, android_app: 0, web: 0, not_set: 0 };
    row[normPlatform(dims[1])] += mets[0];
    dayMap.set(day, row);
  }

  const evMap = new Map();
  for (const { dims, mets } of rowsOf(events)) {
    const row = evMap.get(dims[0]) || { name: dims[0], ios_app: 0, android_app: 0, web: 0, not_set: 0 };
    row[normPlatform(dims[1])] += mets[0];
    evMap.set(dims[0], row);
  }

  const scMap = new Map();
  for (const { dims, mets } of rowsOf(screens)) {
    const row = scMap.get(dims[0]) || { path: dims[0], ios_app: 0, android_app: 0, web: 0, not_set: 0, total: 0 };
    row[normPlatform(dims[1])] += mets[0];
    row.total += mets[0];
    scMap.set(dims[0], row);
  }

  return {
    byPlatform,
    daily: [...dayMap.values()].sort((a, b) => a.day.localeCompare(b.day)),
    events: KEY_EVENTS.map((n) => evMap.get(n)).filter(Boolean),
    screens: [...scMap.values()].sort((a, b) => b.total - a.total).slice(0, 12),
    os: osReport ? rowsOf(osReport).map(({ dims, mets }) => ({ os: dims[0], activeUsers: mets[0] })) : [],
  };
}

const cache = new Map(); // days -> { at, data }
const CACHE_MS = 10 * 60 * 1000;

export async function fetchGaDashboard(days, { env = process.env, fetchImpl = globalThis.fetch, now = Date.now() } = {}) {
  const creds = gaCredentials(env);
  if (!creds.configured) return { configured: false, missing: creds.missing, problem: creds.problem };

  const hit = cache.get(days);
  if (hit && now - hit.at < CACHE_MS) return hit.data;

  const dateRanges = [{ startDate: `${days - 1}daysAgo`, endDate: "today" }];
  const P = { name: PLATFORM_DIM };
  const platformReports = [
    {
      dateRanges,
      dimensions: [P],
      metrics: ["activeUsers", "newUsers", "sessions", "engagedSessions", "userEngagementDuration", "screenPageViews"].map((name) => ({ name })),
    },
    { dateRanges, dimensions: [{ name: "date" }, P], metrics: [{ name: "activeUsers" }], limit: 2000 },
    {
      dateRanges,
      dimensions: [{ name: "eventName" }, P],
      metrics: [{ name: "eventCount" }],
      dimensionFilter: { filter: { fieldName: "eventName", inListFilter: { values: KEY_EVENTS } } },
    },
    {
      dateRanges,
      dimensions: [{ name: "pagePath" }, P],
      metrics: [{ name: "screenPageViews" }],
      orderBys: [{ metric: { metricName: "screenPageViews" }, desc: true }],
      limit: 100,
    },
  ];
  // Operating system needs no custom dimension, so it still works (and shows
  // iPhone vs Android traffic) even before `platform` is registered in GA.
  const osReport = {
    dateRanges,
    dimensions: [{ name: "operatingSystem" }],
    metrics: [{ name: "activeUsers" }],
    orderBys: [{ metric: { metricName: "activeUsers" }, desc: true }],
    limit: 8,
  };

  const [main, os] = await Promise.allSettled([
    batchRun(creds, platformReports, fetchImpl),
    batchRun(creds, [osReport], fetchImpl),
  ]);

  if (main.status === "rejected" && os.status === "rejected") {
    return { configured: true, error: main.reason.message };
  }
  let data;
  if (main.status === "fulfilled") {
    data = { configured: true, ...shapeGaReports(main.value, os.status === "fulfilled" ? os.value[0] : null) };
  } else {
    const msg = main.reason.message;
    data = {
      configured: true,
      ...shapeGaReports([], os.value[0]),
      error: msg,
      hint: /platform/i.test(msg)
        ? "Register `platform` as a User-scoped custom dimension in GA (Admin -> Custom definitions). Data shows ~24 h later."
        : undefined,
    };
  }
  cache.set(days, { at: now, data });
  return data;
}

export function _resetGaCaches() {
  cache.clear();
  tokenCache = { token: null, exp: 0, who: null };
}
