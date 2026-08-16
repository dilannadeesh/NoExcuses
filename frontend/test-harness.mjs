process.env.DATABASE_URL = "postgresql://postgres:testpass@localhost:5432/scoremine_test";
process.env.JWT_SECRET = "test-secret-not-for-production";

import authHandler from "./api/auth/[action].js";
const signup = (req, res) => authHandler({ ...req, query: { ...req.query, action: "signup" } }, res);
const login = (req, res) => authHandler({ ...req, query: { ...req.query, action: "login" } }, res);
const meAction = (req, res) => authHandler({ ...req, query: { ...req.query, action: "me" } }, res);
const forgotPassword = (req, res) => authHandler({ ...req, query: { ...req.query, action: "forgot-password" } }, res);
const resetPassword = (req, res) => authHandler({ ...req, query: { ...req.query, action: "reset-password" } }, res);
import groupsIndex from "./api/groups/index.js";
import groupShow from "./api/groups/[id]/index.js";
import membersIndex from "./api/groups/[id]/members/index.js";
import memberDelete from "./api/groups/[id]/members/[memberId].js";
import gamesIndex from "./api/groups/[id]/games/index.js";
import { getPool } from "./api/_lib/db.js";

function mockRes() {
  const res = {
    statusCode: 200,
    headers: {},
    body: undefined,
    status(code) {
      this.statusCode = code;
      return this;
    },
    setHeader(k, v) {
      this.headers[k] = v;
      return this;
    },
    send(payload) {
      this.body = payload;
      return this;
    },
    end() {
      return this;
    },
  };
  return res;
}

// Very small cookie jar: extracts the session cookie from a Set-Cookie header.
function extractSessionCookie(res) {
  const setCookie = res.headers["Set-Cookie"];
  if (!setCookie) return null;
  const match = setCookie.match(/session=([^;]+)/);
  return match ? `session=${match[1]}` : null;
}

async function call(handler, { method = "GET", query = {}, body, cookie } = {}) {
  const req = { method, query, body, headers: cookie ? { cookie } : {} };
  const res = mockRes();
  await handler(req, res);
  let parsed = res.body;
  try {
    parsed = res.body ? JSON.parse(res.body) : undefined;
  } catch {
    /* not json */
  }
  return { status: res.statusCode, body: parsed, cookie: extractSessionCookie(res) };
}

let failures = 0;
function assert(cond, msg) {
  if (!cond) {
    failures++;
    console.error("FAIL:", msg);
  } else {
    console.log("ok:", msg);
  }
}

const run = async () => {
  // --- Signup: first user becomes admin ---
  let r = await call(signup, { method: "POST", body: { name: "Dilan", email: "dilan@example.com", password: "correcthorse1" } });
  assert(r.status === 201, "signup user1 (dilan) succeeds");
  assert(r.body.isAdmin === true, "first signup is automatically admin");
  const dilanCookie = r.cookie;
  assert(dilanCookie, "signup sets a session cookie");

  // --- Second signup is NOT admin ---
  r = await call(signup, { method: "POST", body: { name: "Priya", email: "priya@example.com", password: "correcthorse2" } });
  assert(r.status === 201 && r.body.isAdmin === false, "second signup is NOT admin");
  const priyaCookie = r.cookie;

  // --- Duplicate signup rejected ---
  r = await call(signup, { method: "POST", body: { name: "Dilan2", email: "dilan@example.com", password: "whatever123" } });
  assert(r.status === 409, "duplicate email signup rejected");

  // --- Login works, wrong password doesn't ---
  r = await call(login, { method: "POST", body: { email: "dilan@example.com", password: "correcthorse1" } });
  assert(r.status === 200, "login with correct password works");
  r = await call(login, { method: "POST", body: { email: "dilan@example.com", password: "wrongpassword" } });
  assert(r.status === 401, "login with wrong password rejected");

  // --- /api/auth/me reflects session ---
  r = await call(meAction, { method: "GET", cookie: dilanCookie });
  assert(r.status === 200 && r.body.email === "dilan@example.com", "me returns correct session user");
  r = await call(meAction, { method: "GET" });
  assert(r.status === 401, "me without cookie is unauthenticated");

  // --- No auth = no groups access ---
  r = await call(groupsIndex, { method: "GET" });
  assert(r.status === 401, "listing groups without auth is rejected");

  // --- Dilan creates a group (becomes owner + auto-member) ---
  r = await call(groupsIndex, { method: "POST", body: { name: "Tuesday Crew" }, cookie: dilanCookie });
  assert(r.status === 201, "dilan creates group");
  const groupId = r.body.id;

  r = await call(membersIndex, { method: "GET", query: { id: groupId }, cookie: dilanCookie });
  assert(r.status === 200 && r.body.length === 1 && r.body[0].email === "dilan@example.com", "owner auto-added as member");

  // --- Priya (not a member) cannot see or act on the group ---
  r = await call(groupShow, { method: "GET", query: { id: groupId }, cookie: priyaCookie });
  assert(r.status === 404, "non-member gets 404 on group (no leak of existence)");
  r = await call(membersIndex, { method: "POST", query: { id: groupId }, body: { name: "X", email: "x@example.com" }, cookie: priyaCookie });
  assert(r.status === 404, "non-member cannot add members either");

  // --- Dilan invites Priya by email (existing account) — should link, not duplicate ---
  r = await call(membersIndex, { method: "POST", query: { id: groupId }, body: { name: "Priya", email: "priya@example.com" }, cookie: dilanCookie });
  assert(r.status === 201 && r.body.has_joined === true, "inviting an existing account links it (has_joined=true)");

  // --- Dilan invites someone who hasn't signed up yet ---
  r = await call(membersIndex, { method: "POST", query: { id: groupId }, body: { name: "Sam", email: "sam@example.com" }, cookie: dilanCookie });
  assert(r.status === 201 && r.body.has_joined === false, "inviting a new email creates a placeholder (has_joined=false)");
  const samPlaceholderId = r.body.id;

  r = await call(membersIndex, { method: "GET", query: { id: groupId }, cookie: dilanCookie });
  assert(r.body.length === 3, "group now has 3 members (dilan, priya, sam-placeholder)");

  // --- Priya (now a member) CAN log a game ---
  r = await call(gamesIndex, {
    method: "POST",
    query: { id: groupId },
    cookie: priyaCookie,
    body: {
      match_type: "singles",
      played_at: "2026-08-01",
      side1: [(await call(meAction, { cookie: dilanCookie })).body.id],
      side2: [(await call(meAction, { cookie: priyaCookie })).body.id],
      sets: [{ side1_score: 21, side2_score: 15 }],
    },
  });
  assert(r.status === 201, "member (priya) can log a game she's playing in");

  // --- Sam (placeholder, hasn't signed up / has no session) cannot act at all ---
  r = await call(gamesIndex, { method: "GET", query: { id: groupId } }); // no cookie
  assert(r.status === 401, "no session at all -> 401");

  // --- Sam claims their placeholder account via signup with the same email ---
  r = await call(signup, { method: "POST", body: { name: "Sam Real Name", email: "sam@example.com", password: "samspassword" } });
  assert(r.status === 201, "sam claims placeholder account via signup");
  assert(r.body.id === samPlaceholderId, "claimed account keeps the same user id (group membership carries over)");
  const samCookie = r.cookie;

  r = await call(membersIndex, { method: "GET", query: { id: groupId }, cookie: samCookie });
  assert(r.status === 200 && r.body.length === 3, "sam can now access the group they were pre-invited to");

  // --- A random 4th user is NOT a member and cannot log games ---
  r = await call(signup, { method: "POST", body: { name: "Wei", email: "wei@example.com", password: "weispassword1" } });
  const weiCookie = r.cookie;
  const weiId = r.body.id;
  r = await call(gamesIndex, {
    method: "POST",
    query: { id: groupId },
    cookie: weiCookie,
    body: {
      match_type: "singles",
      played_at: "2026-08-02",
      side1: [weiId],
      side2: [samPlaceholderId],
      sets: [{ side1_score: 21, side2_score: 10 }],
    },
  });
  assert(r.status === 404, "non-member (wei) gets 404 trying to log a game in a group they can't see");

  // --- Can't log a game with a player who isn't a group member, even as a valid member ---
  r = await call(gamesIndex, {
    method: "POST",
    query: { id: groupId },
    cookie: dilanCookie,
    body: {
      match_type: "singles",
      played_at: "2026-08-02",
      side1: [weiId], // wei is NOT a member of this group
      side2: [samPlaceholderId],
      sets: [{ side1_score: 21, side2_score: 10 }],
    },
  });
  assert(r.status === 400, "cannot log a game featuring a non-member player");

  // --- Admin (dilan) can see Wei's groups even without being a member ---
  r = await call(groupsIndex, { method: "POST", body: { name: "Wei's Solo Group" }, cookie: weiCookie });
  const weiGroupId = r.body.id;
  r = await call(groupsIndex, { method: "GET", cookie: dilanCookie });
  assert(
    r.body.some((g) => g.id === weiGroupId),
    "admin sees every group, including ones they're not a member of"
  );
  r = await call(groupsIndex, { method: "GET", cookie: priyaCookie });
  assert(
    !r.body.some((g) => g.id === weiGroupId),
    "non-admin, non-member does NOT see wei's group"
  );

  // --- Admin can SEE but not INVITE into a group they don't own ---
  r = await call(membersIndex, {
    method: "POST",
    query: { id: weiGroupId },
    body: { name: "Intruder", email: "intruder@example.com" },
    cookie: dilanCookie, // dilan is admin, but not owner of wei's group
  });
  assert(r.status === 403, "admin (non-owner) cannot invite members into someone else's group");

  // Owner can still invite into their own group
  r = await call(membersIndex, {
    method: "POST",
    query: { id: weiGroupId },
    body: { name: "Legit Invite", email: "legit@example.com" },
    cookie: weiCookie,
  });
  assert(r.status === 201, "owner can invite members into their own group");
  const legitInviteId = r.body.id;

  // --- Admin can SEE but not REMOVE members from a group they don't own ---
  r = await call(memberDelete, {
    method: "DELETE",
    query: { id: weiGroupId, memberId: legitInviteId },
    cookie: dilanCookie, // dilan is admin, but not owner of wei's group
  });
  assert(r.status === 403, "admin (non-owner) cannot remove members from someone else's group");

  // Owner can still remove members from their own group
  r = await call(memberDelete, { method: "DELETE", query: { id: weiGroupId, memberId: legitInviteId }, cookie: weiCookie });
  assert(r.status === 204, "owner can remove members from their own group");

  // --- Owner removes a member ---
  r = await call(memberDelete, { method: "DELETE", query: { id: groupId, memberId: weiId }, cookie: dilanCookie });
  // wei was never added to this group, so this just confirms no crash / correct 204 on a no-op delete
  assert(r.status === 204, "member removal (no-op case) returns 204 cleanly");
  r = await call(memberDelete, { method: "DELETE", query: { id: groupId, memberId: samPlaceholderId }, cookie: dilanCookie });
  assert(r.status === 204, "owner removes sam from the group");
  r = await call(membersIndex, { method: "GET", query: { id: groupId }, cookie: dilanCookie });
  assert(r.body.length === 2, "group has 2 members after removal");

  // --- Non-owner member CANNOT remove members ---
  r = await call(memberDelete, { method: "DELETE", query: { id: groupId, memberId: weiId }, cookie: priyaCookie });
  assert(r.status === 403, "non-owner member cannot remove members");

  // --- Forgot password / reset password flow ---
  r = await call(forgotPassword, { method: "POST", body: { email: "priya@example.com" } });
  assert(r.status === 200, "forgot-password returns 200 for a known email");
  r = await call(forgotPassword, { method: "POST", body: { email: "doesnotexist@example.com" } });
  assert(r.status === 200, "forgot-password ALSO returns 200 for an unknown email (no enumeration)");

  // Fetch the token directly from the DB, simulating "clicking the emailed link"
  const db = getPool();
  const { rows: tokenRows } = await db.query(
    `SELECT prt.token FROM password_reset_tokens prt
     JOIN users u ON u.id = prt.user_id WHERE u.email = 'priya@example.com'
     ORDER BY prt.expires_at DESC LIMIT 1`
  );
  const resetToken = tokenRows[0].token;

  r = await call(resetPassword, { method: "POST", body: { token: "not-a-real-token", password: "newpassword1" } });
  assert(r.status === 400, "reset with a bogus token is rejected");

  r = await call(resetPassword, { method: "POST", body: { token: resetToken, password: "newpassword1" } });
  assert(r.status === 200, "reset with the real token succeeds");

  r = await call(login, { method: "POST", body: { email: "priya@example.com", password: "correcthorse2" } });
  assert(r.status === 401, "old password no longer works after reset");
  r = await call(login, { method: "POST", body: { email: "priya@example.com", password: "newpassword1" } });
  assert(r.status === 200, "new password works after reset");

  r = await call(resetPassword, { method: "POST", body: { token: resetToken, password: "anotherpassword" } });
  assert(r.status === 400, "reset token cannot be reused");

  console.log(failures === 0 ? "\nALL PASSED" : `\n${failures} FAILURE(S)`);
  process.exit(failures === 0 ? 0 : 1);
};

run().catch((e) => {
  console.error("Unhandled error:", e);
  process.exit(1);
});
