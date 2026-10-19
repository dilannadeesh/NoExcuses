// Group invite emails + has_expenses flag (real Postgres, Resend faked).
// Run: npm run test:invite   (same local Postgres as test-harness.mjs)
process.env.DATABASE_URL = "postgresql://postgres:testpass@localhost:5432/scoremine_test";
process.env.JWT_SECRET = "test-secret-not-for-production";
process.env.APP_URL = "https://example.test";
process.env.RESEND_API_KEY = "re_test";

import authHandler from "./api/auth/[action].js";
import groupsIndex from "./api/groups/index.js";
import groupShow from "./api/groups/[id]/index.js";
import membersIndex from "./api/groups/[id]/members/index.js";
import { getPool } from "./api/_lib/db.js";
import { inviteEmail } from "./api/_lib/email.js";

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
let resendFails = false;
const realFetch = globalThis.fetch;
globalThis.fetch = async (url, init) => {
  if (String(url).includes("api.resend.com")) {
    if (resendFails) return { ok: false, status: 500, text: async () => "boom", json: async () => ({}) };
    sent.push(JSON.parse(init.body));
    return { ok: true, status: 200, json: async () => ({ id: "em_1" }), text: async () => "" };
  }
  return realFetch(url, init);
};

const run = async () => {
  const db = getPool();
  await db.query("DROP SCHEMA public CASCADE; CREATE SCHEMA public;");
  const signup = (name, email) =>
    call(authHandler, { method: "POST", query: { action: "signup" }, url: "/api/auth/signup", body: { name, email, password: "correcthorse1" } });

  const owner = (await signup("Priya", "priya@example.com")).cookie;
  const sam = await signup("Sam", "sam@example.com");
  sent.length = 0; // signups send nothing, but be safe

  let r = await call(groupsIndex, { method: "POST", body: { name: "Tuesday Crew" }, cookie: owner });
  const groupId = r.body.id;
  r = await call(groupShow, { query: { id: groupId }, cookie: owner });
  assert(r.body.has_expenses === false, "new group: has_expenses is false");

  // New person (no account yet) -> sign-up invite with their email prefilled.
  r = await call(membersIndex, { method: "POST", query: { id: groupId }, body: { name: "Wei Chen", email: "Wei@Example.com" }, cookie: owner });
  assert(r.status === 201 && r.body.inviteEmailSent === true, "adding a new person sends an invite");
  assert(sent.length === 1 && sent[0].to[0] === "wei@example.com", "invite goes to the normalised address");
  assert(sent[0].subject === "Priya added you to Tuesday Crew", `subject names inviter + group (${sent[0].subject})`);
  assert(sent[0].html.includes("https://example.test/signup?email=wei%40example.com"), "link opens sign-up with the email filled in");
  assert(/this email address/i.test(sent[0].text), "text tells them to use this same email");

  // Existing account -> "open the app" link straight to the group.
  r = await call(membersIndex, { method: "POST", query: { id: groupId }, body: { name: "Sam", email: "sam@example.com" }, cookie: owner });
  assert(r.body.inviteEmailSent && sent.length === 2, "adding an existing user also emails them");
  assert(sent[1].html.includes(`https://example.test/groups/${groupId}`) && sent[1].html.includes("Open the app"), "existing user gets a link to the group");

  // Adding the same person again: no second email.
  r = await call(membersIndex, { method: "POST", query: { id: groupId }, body: { name: "Wei", email: "wei@example.com" }, cookie: owner });
  assert(r.status === 201 && r.body.inviteEmailSent === false && sent.length === 2, "re-adding a member sends nothing");

  // Adding yourself: no email.
  r = await call(membersIndex, { method: "POST", query: { id: groupId }, body: { name: "Priya", email: "priya@example.com" }, cookie: owner });
  assert(sent.length === 2, "never emails the person doing the adding");

  // Email service down: the add still works.
  resendFails = true;
  r = await call(membersIndex, { method: "POST", query: { id: groupId }, body: { name: "Alex", email: "alex@example.com" }, cookie: owner });
  assert(r.status === 201 && r.body.inviteEmailSent === false, "email failure never blocks adding a player");
  resendFails = false;

  // The invitee signs up with the invited email -> the group is already theirs.
  const wei = (await signup("Wei Chen", "wei@example.com")).cookie;
  r = await call(groupsIndex, { method: "GET", cookie: wei });
  assert(Array.isArray(r.body) && r.body.some((g) => g.id === groupId), "after sign-up the group is on their home screen");

  // has_expenses flips once a real expense exists.
  const ids = (await db.query("SELECT id, email FROM users")).rows;
  const priyaId = ids.find((u) => u.email === "priya@example.com").id;
  await db.query("INSERT INTO expenses (group_id, paid_by, amount_cents, description, created_by) VALUES ($1,$2,4800,'Court',$2)", [groupId, priyaId]);
  r = await call(groupShow, { query: { id: groupId }, cookie: owner });
  assert(r.body.has_expenses === true, "has_expenses true after a cost is added");

  // Template escapes names (no HTML injection from a group name).
  const e = inviteEmail({ name: "<b>x</b>", inviterName: "A&B", groupName: "<script>", url: "https://x", joined: false });
  assert(!e.html.includes("<script>") && e.html.includes("&lt;script&gt;"), "email HTML escapes user text");

  void sam;
  console.log(failures === 0 ? "\nALL PASSED" : `\n${failures} FAILURE(S)`);
  await db.end();
  process.exit(failures ? 1 : 0);
};
run().catch((e) => { console.error("Unhandled error:", e); process.exit(1); });
