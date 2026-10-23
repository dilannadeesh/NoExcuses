// Leave group, owner protection and content reports (real Postgres, email faked).
// Run: npm run test:safety   (same local Postgres as test-harness.mjs)
process.env.DATABASE_URL = "postgresql://postgres:testpass@localhost:5432/scoremine_test";
process.env.JWT_SECRET = "test-secret-not-for-production";
process.env.RESEND_API_KEY = "re_test";
process.env.REPORTS_EMAIL = "reports@example.test";

import authHandler from "./api/auth/[action].js";
import groupsIndex from "./api/groups/index.js";
import membersIndex from "./api/groups/[id]/members/index.js";
import memberDelete from "./api/groups/[id]/members/[memberId].js";
import meHandler from "./api/me.js";
import { getPool } from "./api/_lib/db.js";

let failures = 0;
const assert = (c, m) => (c ? console.log("ok:", m) : (failures++, console.error("FAIL:", m)));
async function call(handler, { method = "GET", query = {}, body, cookie, url } = {}) {
  const req = { method, query, body, url, headers: cookie ? { cookie } : {} };
  const res = {
    statusCode: 200, headers: {}, body: undefined,
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
const sent = [];
globalThis.fetch = async (url, init) => {
  if (String(url).includes("api.resend.com")) { sent.push(JSON.parse(init.body)); return { ok: true, status: 200, json: async () => ({}), text: async () => "" }; }
  throw new Error("unexpected network call " + url);
};

const run = async () => {
  const db = getPool();
  await db.query("DROP SCHEMA public CASCADE; CREATE SCHEMA public;");
  const signup = (name, email) =>
    call(authHandler, { method: "POST", query: { action: "signup" }, url: "/api/auth/signup", body: { name, email, password: "correcthorse1" } });
  const priya = await signup("Priya", "priya@example.com");
  const sam = await signup("Sam", "sam@example.com");
  const out = await signup("Outsider", "out@example.com");
  const ids = Object.fromEntries((await db.query("SELECT id, name FROM users")).rows.map((u) => [u.name, u.id]));

  let r = await call(groupsIndex, { method: "POST", body: { name: "Tuesday Crew" }, cookie: priya.cookie });
  const g = r.body.id;
  await call(membersIndex, { method: "POST", query: { id: g }, body: { name: "Sam", email: "sam@example.com" }, cookie: priya.cookie });
  await call(membersIndex, { method: "POST", query: { id: g }, body: { name: "Wei", email: "wei@example.com" }, cookie: priya.cookie });
  const weiId = (await db.query("SELECT id FROM users WHERE email='wei@example.com'")).rows[0].id;
  sent.length = 0;

  // Reports
  r = await call(meHandler, { method: "POST", query: { report: "1" }, body: { groupId: g, reportedUserId: weiId, reason: "Harassment or bullying", details: "Rude names" }, cookie: sam.cookie });
  assert(r.status === 201 && r.body.id, "a member can report a problem in their group");
  const rep = (await db.query("SELECT * FROM content_reports WHERE id = $1", [r.body.id])).rows[0];
  assert(rep.reporter_id === ids.Sam && rep.group_id === g && rep.reported_user_id === weiId, "report is stored with who, where and about whom");
  assert(sent.length === 1 && sent[0].to[0] === "reports@example.test" && sent[0].reply_to === "sam@example.com", "report is emailed to the team, reply-to the reporter");
  assert(/24 hours/.test(sent[0].text) && sent[0].subject.includes("Tuesday Crew"), "email names the group and the 24-hour rule");
  r = await call(meHandler, { method: "POST", query: { report: "1" }, body: { groupId: g, reason: "nope" }, cookie: sam.cookie });
  assert(r.status === 400, "a report needs a known reason");
  r = await call(meHandler, { method: "POST", query: { report: "1" }, body: { groupId: g, reason: "Something else" }, cookie: out.cookie });
  assert(r.status === 404, "outsiders can't report (or probe) a group they're not in");
  r = await call(meHandler, { method: "POST", query: { report: "1" }, body: { reason: "Spam or fake account" } });
  assert(r.status === 401, "reports need to be signed in");

  // Leave / remove rules
  r = await call(memberDelete, { method: "DELETE", query: { id: g, memberId: String(weiId) }, cookie: sam.cookie });
  assert(r.status === 403, "a member can't remove someone else");
  r = await call(memberDelete, { method: "DELETE", query: { id: g, memberId: String(ids.Priya) }, cookie: priya.cookie });
  assert(r.status === 409, "the owner can't leave their own group");
  r = await call(memberDelete, { method: "DELETE", query: { id: g, memberId: String(ids.Sam) }, cookie: sam.cookie });
  assert(r.status === 204, "a member can leave");
  r = await call(groupsIndex, { method: "GET", cookie: sam.cookie });
  assert(!r.body.some((x) => x.id === g), "after leaving, the group is gone from their list");
  r = await call(memberDelete, { method: "DELETE", query: { id: g, memberId: String(weiId) }, cookie: priya.cookie });
  assert(r.status === 204, "the owner can still remove members");

  console.log(failures === 0 ? "\nALL PASSED" : `\n${failures} FAILURE(S)`);
  await db.end();
  process.exit(failures ? 1 : 0);
};
run().catch((e) => { console.error("Unhandled error:", e); process.exit(1); });
