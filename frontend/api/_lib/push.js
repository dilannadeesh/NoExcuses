import crypto from "node:crypto";
import http2 from "node:http2";

// Push notifications to people's phones.
//   iPhone  -> Apple's push service (APNs), using an APNs auth key (.p8)
//   Android -> Firebase Cloud Messaging (FCM v1), using a service account
// Nothing is sent until the matching environment variables exist, and a
// failed push never fails the request that caused it.
//
//   APNS_KEY_P8      full text of AuthKey_XXXX.p8 (Apple Push Notifications service key)
//   APNS_KEY_ID      that key's 10-character ID
//   APNS_TEAM_ID     Apple developer Team ID
//   APNS_BUNDLE_ID   optional, defaults to noexcusesbadminton.app
//   APNS_SANDBOX     optional, "1" to use Apple's sandbox (Xcode debug builds only)
//   FIREBASE_SERVICE_ACCOUNT   service-account JSON (Android)

const b64url = (input) => Buffer.from(input).toString("base64url");
const withTimeout = (p, ms, label) =>
  Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error(`${label} timed out`)), ms))]);

export function pushStatus(env = process.env) {
  return { ios: Boolean(env.APNS_KEY_P8 && env.APNS_KEY_ID && env.APNS_TEAM_ID), android: Boolean(env.FIREBASE_SERVICE_ACCOUNT) };
}

// ---- Apple ---------------------------------------------------------------

let apnsJwt = { token: null, at: 0 };
export function makeApnsJwt(env = process.env, now = Date.now()) {
  if (apnsJwt.token && now - apnsJwt.at < 40 * 60 * 1000) return apnsJwt.token;
  const key = env.APNS_KEY_P8.replace(/\\n/g, "\n");
  const head = b64url(JSON.stringify({ alg: "ES256", kid: env.APNS_KEY_ID }));
  const body = b64url(JSON.stringify({ iss: env.APNS_TEAM_ID, iat: Math.floor(now / 1000) }));
  const sig = crypto.sign("sha256", Buffer.from(`${head}.${body}`), { key, dsaEncoding: "ieee-p1363" });
  const token = `${head}.${body}.${b64url(sig)}`;
  apnsJwt = { token, at: now };
  return token;
}

export function apnsPayload({ title, body, data }) {
  return { aps: { alert: { title, body }, sound: "default" }, ...(data || {}) };
}

// Returns [{ token, ok, gone }] -- gone = Apple says this device token is dead.
async function sendApns(tokens, message, env = process.env) {
  const host = env.APNS_SANDBOX === "1" ? "https://api.sandbox.push.apple.com" : "https://api.push.apple.com";
  const topic = env.APNS_BUNDLE_ID || "noexcusesbadminton.app";
  const jwt = makeApnsJwt(env);
  const session = http2.connect(host);
  session.on("error", () => {});
  try {
    const payload = JSON.stringify(apnsPayload(message));
    return await Promise.all(
      tokens.map(
        (token) =>
          new Promise((resolve) => {
            const req = session.request({
              ":method": "POST",
              ":path": `/3/device/${token}`,
              authorization: `bearer ${jwt}`,
              "apns-topic": topic,
              "apns-push-type": "alert",
              "apns-priority": "10",
              "content-type": "application/json",
            });
            let status = 0;
            let text = "";
            req.on("response", (h) => (status = h[":status"]));
            req.on("data", (c) => (text += c));
            req.on("end", () => {
              const reason = (() => { try { return JSON.parse(text).reason; } catch { return ""; } })();
              resolve({ token, ok: status === 200, gone: status === 410 || reason === "BadDeviceToken" || reason === "Unregistered" });
            });
            req.on("error", () => resolve({ token, ok: false, gone: false }));
            req.setTimeout(8000, () => { req.close(); resolve({ token, ok: false, gone: false }); });
            req.end(payload);
          })
      )
    );
  } finally {
    session.close();
  }
}

// ---- Firebase / Android ---------------------------------------------------

let fcmAccess = { token: null, exp: 0 };
async function fcmAccessToken(sa) {
  if (fcmAccess.token && Date.now() < fcmAccess.exp - 60_000) return fcmAccess.token;
  const iat = Math.floor(Date.now() / 1000);
  const head = b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claims = b64url(
    JSON.stringify({ iss: sa.client_email, scope: "https://www.googleapis.com/auth/firebase.messaging", aud: "https://oauth2.googleapis.com/token", iat, exp: iat + 3600 })
  );
  const sig = crypto.sign("RSA-SHA256", Buffer.from(`${head}.${claims}`), sa.private_key);
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: `${head}.${claims}.${b64url(sig)}` }),
  });
  const json = await res.json();
  if (!json.access_token) throw new Error("FCM auth failed");
  fcmAccess = { token: json.access_token, exp: Date.now() + (json.expires_in || 3600) * 1000 };
  return fcmAccess.token;
}

async function sendFcm(tokens, { title, body, data }, env = process.env) {
  const sa = JSON.parse(env.FIREBASE_SERVICE_ACCOUNT);
  const access = await fcmAccessToken(sa);
  return Promise.all(
    tokens.map(async (token) => {
      try {
        const res = await fetch(`https://fcm.googleapis.com/v1/projects/${sa.project_id}/messages:send`, {
          method: "POST",
          headers: { Authorization: `Bearer ${access}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            message: { token, notification: { title, body }, data: Object.fromEntries(Object.entries(data || {}).map(([k, v]) => [k, String(v)])) },
          }),
        });
        return { token, ok: res.ok, gone: res.status === 404 || res.status === 400 };
      } catch {
        return { token, ok: false, gone: false };
      }
    })
  );
}

// Swappable so tests never touch the network.
export const transports = { ios: sendApns, android: sendFcm };

// Sends to every registered device of `userIds`. Never throws.
export async function sendPush(db, userIds, message, env = process.env) {
  try {
    const status = pushStatus(env);
    if (!userIds.length || (!status.ios && !status.android)) return { sent: 0 };
    const { rows } = await db.query("SELECT token, platform FROM push_tokens WHERE user_id = ANY($1::int[])", [userIds]);
    let sent = 0;
    const dead = [];
    for (const platform of ["ios", "android"]) {
      if (!status[platform]) continue;
      const tokens = rows.filter((r) => r.platform === platform).map((r) => r.token);
      if (!tokens.length) continue;
      const results = await withTimeout(transports[platform](tokens, message, env), 10_000, platform).catch(() => []);
      for (const r of results) {
        if (r.ok) sent++;
        if (r.gone) dead.push(r.token);
      }
    }
    if (dead.length) await db.query("DELETE FROM push_tokens WHERE token = ANY($1::text[])", [dead]);
    return { sent };
  } catch {
    return { sent: 0 };
  }
}
