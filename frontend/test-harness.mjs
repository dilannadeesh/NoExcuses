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
import analyticsHandler from "./api/groups/[id]/analytics.js";
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

  // --- Ranking method: default, owner-only change, and points vs win% sort order ---
  r = await call(groupsIndex, { method: "POST", body: { name: "Ranking Test Group" }, cookie: dilanCookie });
  const rankGroupId = r.body.id;
  assert(r.body.ranking_method === "win_percentage", "new groups default to win_percentage ranking");

  // Priya is not a member of this group -- confirm she can't change its settings
  r = await call(groupShow, {
    method: "PATCH",
    query: { id: rankGroupId },
    body: { ranking_method: "points" },
    cookie: priyaCookie,
  });
  assert(r.status === 404, "non-member can't change ranking method (group not even visible to them)");

  // Add two players: one will go 1-0 (100%), the other 4-1 (80% but more net points)
  r = await call(membersIndex, {
    method: "POST",
    query: { id: rankGroupId },
    body: { name: "HighPct", email: "highpct@example.com" },
    cookie: dilanCookie,
  });
  const highPctId = r.body.id;
  r = await call(membersIndex, {
    method: "POST",
    query: { id: rankGroupId },
    body: { name: "HighVolume", email: "highvolume@example.com" },
    cookie: dilanCookie,
  });
  const highVolumeId = r.body.id;
  r = await call(membersIndex, {
    method: "POST",
    query: { id: rankGroupId },
    body: { name: "Punchbag", email: "punchbag@example.com" },
    cookie: dilanCookie,
  });
  const punchbagId = r.body.id;

  // HighPct: 1 win, 0 losses -> 100%, 10 points
  await call(gamesIndex, {
    method: "POST",
    query: { id: rankGroupId },
    cookie: dilanCookie,
    body: {
      match_type: "singles",
      played_at: "2026-09-01",
      side1: [highPctId],
      side2: [punchbagId],
      sets: [{ side1_score: 21, side2_score: 10 }],
    },
  });
  // HighVolume: 4 wins, 1 loss -> 80%, 30 points (beats win% but loses on points... the other way)
  for (let i = 0; i < 4; i++) {
    await call(gamesIndex, {
      method: "POST",
      query: { id: rankGroupId },
      cookie: dilanCookie,
      body: {
        match_type: "singles",
        played_at: "2026-09-02",
        side1: [highVolumeId],
        side2: [punchbagId],
        sets: [{ side1_score: 21, side2_score: 10 }],
      },
    });
  }
  await call(gamesIndex, {
    method: "POST",
    query: { id: rankGroupId },
    cookie: dilanCookie,
    body: {
      match_type: "singles",
      played_at: "2026-09-02",
      side1: [highVolumeId],
      side2: [punchbagId],
      sets: [{ side1_score: 10, side2_score: 21 }],
    },
  });

  // Default (win_percentage): HighPct (100%) ranks above HighVolume (80%)
  r = await call(analyticsHandler, { method: "GET", query: { id: rankGroupId }, cookie: dilanCookie });
  assert(r.body.rankingMethod === "win_percentage", "analytics reports the group's current ranking method");
  let top = r.body.playerStats[0];
  assert(top.id === highPctId, "under win_percentage, the 100% player (fewer games) ranks first");

  const highVolumeStats = r.body.playerStats.find((p) => p.id === highVolumeId);
  assert(highVolumeStats.points === 30, "points are computed even when not the active ranking method (4 wins - 1 loss = 30)");

  // Owner switches to points ranking
  r = await call(groupShow, {
    method: "PATCH",
    query: { id: rankGroupId },
    body: { ranking_method: "points" },
    cookie: dilanCookie,
  });
  assert(r.status === 200 && r.body.ranking_method === "points", "owner can switch the group to points ranking");

  // Now HighVolume (30 points) should outrank HighPct (10 points) -- the sort order actually flips
  r = await call(analyticsHandler, { method: "GET", query: { id: rankGroupId }, cookie: dilanCookie });
  assert(r.body.rankingMethod === "points", "analytics now reports points as the ranking method");
  top = r.body.playerStats[0];
  assert(top.id === highVolumeId, "under points, the higher net-points player ranks first, even with a lower win%");

  // Reject invalid ranking method values (elo is now a real one, so use a genuinely bogus value)
  r = await call(groupShow, {
    method: "PATCH",
    query: { id: rankGroupId },
    body: { ranking_method: "average_score" },
    cookie: dilanCookie,
  });
  assert(r.status === 400, "an unsupported ranking_method value is rejected");

  // --- Elo ranking: verify the actual math, not just that a number appears ---
  r = await call(groupsIndex, { method: "POST", body: { name: "Elo Test Club" }, cookie: dilanCookie });
  const eloGroupId = r.body.id;
  const eloPlayers = {};
  for (const [name, email] of [
    ["EloP1", "elop1@example.com"],
    ["EloP2", "elop2@example.com"],
    ["EloP3", "elop3@example.com"],
    ["EloP4", "elop4@example.com"],
  ]) {
    r = await call(membersIndex, { method: "POST", query: { id: eloGroupId }, body: { name, email }, cookie: dilanCookie });
    eloPlayers[name] = r.body.id;
  }
  await call(groupShow, { method: "PATCH", query: { id: eloGroupId }, body: { ranking_method: "elo" }, cookie: dilanCookie });

  // Game 1: two brand-new players (both start at 1000) -- singles, P1 beats P2.
  // Expected score for an even match is exactly 0.5, so the swing is the
  // full K-factor/2 = 16. This is the one exact, hand-verifiable case.
  await call(gamesIndex, {
    method: "POST",
    query: { id: eloGroupId },
    cookie: dilanCookie,
    body: {
      match_type: "singles",
      played_at: "2026-01-01",
      side1: [eloPlayers.EloP1],
      side2: [eloPlayers.EloP2],
      sets: [{ side1_score: 21, side2_score: 15 }],
    },
  });
  r = await call(analyticsHandler, { method: "GET", query: { id: eloGroupId }, cookie: dilanCookie });
  let p1 = r.body.playerStats.find((p) => p.id === eloPlayers.EloP1);
  let p2 = r.body.playerStats.find((p) => p.id === eloPlayers.EloP2);
  assert(p1.eloRating === 1016, `even-match winner gains exactly K/2=16 (got ${p1.eloRating})`);
  assert(p2.eloRating === 984, `even-match loser drops exactly K/2=16 (got ${p2.eloRating})`);

  // Build a real rating gap: P1 keeps beating P3 (a separate, still-1000 player)
  // twice more, so P1 pulls well ahead of the field before the upset test below.
  for (let i = 0; i < 2; i++) {
    await call(gamesIndex, {
      method: "POST",
      query: { id: eloGroupId },
      cookie: dilanCookie,
      body: {
        match_type: "singles",
        played_at: `2026-01-0${i + 2}`,
        side1: [eloPlayers.EloP1],
        side2: [eloPlayers.EloP3],
        sets: [{ side1_score: 21, side2_score: 10 }],
      },
    });
  }
  r = await call(analyticsHandler, { method: "GET", query: { id: eloGroupId }, cookie: dilanCookie });
  p1 = r.body.playerStats.find((p) => p.id === eloPlayers.EloP1);
  const p3 = r.body.playerStats.find((p) => p.id === eloPlayers.EloP3);
  assert(p1.eloRating > 1030, `P1 has pulled well ahead after 3 straight wins (rating ${p1.eloRating})`);
  assert(p3.eloRating < 975, `P3 has fallen behind after 2 losses (rating ${p3.eloRating})`);

  const favoriteRatingBefore = p1.eloRating;
  // EloP4 hasn't played a game yet, so it won't appear in playerStats at all
  // -- but every unplayed player starts at ELO_STARTING_RATING by definition.
  const underdogRatingBefore = 1000;

  // THE KEY TEST (this is literally the user's scenario): underdog (P4, ~1000)
  // upsets the favorite (P1, well above 1030). The swing should be BIGGER
  // than the baseline 16 in both directions -- bigger gain for the winning
  // underdog, bigger loss for the losing favorite.
  await call(gamesIndex, {
    method: "POST",
    query: { id: eloGroupId },
    cookie: dilanCookie,
    body: {
      match_type: "singles",
      played_at: "2026-01-10",
      side1: [eloPlayers.EloP1], // favorite
      side2: [eloPlayers.EloP4], // underdog
      sets: [{ side1_score: 15, side2_score: 21 }], // underdog wins
    },
  });
  r = await call(analyticsHandler, { method: "GET", query: { id: eloGroupId }, cookie: dilanCookie });
  const favoriteAfterUpset = r.body.playerStats.find((p) => p.id === eloPlayers.EloP1).eloRating;
  const underdogAfterUpset = r.body.playerStats.find((p) => p.id === eloPlayers.EloP4).eloRating;
  const favoriteLoss = favoriteRatingBefore - favoriteAfterUpset;
  const underdogGain = underdogAfterUpset - underdogRatingBefore;
  assert(favoriteLoss > 16, `favorite loses MORE than the 16-point baseline on an upset loss (lost ${favoriteLoss})`);
  assert(underdogGain > 16, `underdog gains MORE than the 16-point baseline on an upset win (gained ${underdogGain})`);

  // THE MIRROR CASE: a still-intact rating gap (P1 vs P3, untouched by the
  // P1-vs-P4 upset above), favorite wins as expected -- swing should be
  // SMALLER than 16 in both directions. (Deliberately not reusing P1 vs P4
  // here: that upset just narrowed their gap to near-nothing, so P1 isn't
  // meaningfully "the favorite" against P4 anymore -- which is itself
  // correct Elo behavior, just not what this particular check needs.)
  r = await call(analyticsHandler, { method: "GET", query: { id: eloGroupId }, cookie: dilanCookie });
  const favoriteBeforeExpectedWin = r.body.playerStats.find((p) => p.id === eloPlayers.EloP1).eloRating;
  const underdogBeforeExpectedLoss = r.body.playerStats.find((p) => p.id === eloPlayers.EloP3).eloRating;
  await call(gamesIndex, {
    method: "POST",
    query: { id: eloGroupId },
    cookie: dilanCookie,
    body: {
      match_type: "singles",
      played_at: "2026-01-11",
      side1: [eloPlayers.EloP1],
      side2: [eloPlayers.EloP3],
      sets: [{ side1_score: 21, side2_score: 18 }], // favorite wins, as expected
    },
  });
  r = await call(analyticsHandler, { method: "GET", query: { id: eloGroupId }, cookie: dilanCookie });
  const favoriteGain = r.body.playerStats.find((p) => p.id === eloPlayers.EloP1).eloRating - favoriteBeforeExpectedWin;
  const underdogLoss = underdogBeforeExpectedLoss - r.body.playerStats.find((p) => p.id === eloPlayers.EloP3).eloRating;
  assert(favoriteGain < 16 && favoriteGain > 0, `favorite gains LESS than 16 winning as expected (gained ${favoriteGain})`);
  assert(underdogLoss < 16 && underdogLoss > 0, `underdog loses LESS than 16 losing as expected (lost ${underdogLoss})`);

  // Sort order actually flips to eloRating under the elo method
  r = await call(analyticsHandler, { method: "GET", query: { id: eloGroupId }, cookie: dilanCookie });
  assert(r.body.rankingMethod === "elo", "analytics reports elo as the active ranking method");
  const sorted = r.body.playerStats;
  assert(
    sorted.every((p, i) => i === 0 || sorted[i - 1].eloRating >= p.eloRating),
    "player standings are actually sorted by eloRating, descending"
  );

  // Doubles: a swing applies equally to BOTH players on a side
  r = await call(groupsIndex, { method: "POST", body: { name: "Elo Doubles Test" }, cookie: dilanCookie });
  const eloDoublesGroupId = r.body.id;
  const doublesPlayers = {};
  for (const [name, email] of [
    ["DP1", "dp1@example.com"],
    ["DP2", "dp2@example.com"],
    ["DP3", "dp3@example.com"],
    ["DP4", "dp4@example.com"],
  ]) {
    r = await call(membersIndex, { method: "POST", query: { id: eloDoublesGroupId }, body: { name, email }, cookie: dilanCookie });
    doublesPlayers[name] = r.body.id;
  }
  await call(groupShow, { method: "PATCH", query: { id: eloDoublesGroupId }, body: { ranking_method: "elo" }, cookie: dilanCookie });
  await call(gamesIndex, {
    method: "POST",
    query: { id: eloDoublesGroupId },
    cookie: dilanCookie,
    body: {
      match_type: "doubles",
      played_at: "2026-01-01",
      side1: [doublesPlayers.DP1, doublesPlayers.DP2],
      side2: [doublesPlayers.DP3, doublesPlayers.DP4],
      sets: [{ side1_score: 21, side2_score: 15 }],
    },
  });
  r = await call(analyticsHandler, { method: "GET", query: { id: eloDoublesGroupId }, cookie: dilanCookie });
  const dp1 = r.body.playerStats.find((p) => p.id === doublesPlayers.DP1).eloRating;
  const dp2 = r.body.playerStats.find((p) => p.id === doublesPlayers.DP2).eloRating;
  const dp3 = r.body.playerStats.find((p) => p.id === doublesPlayers.DP3).eloRating;
  const dp4 = r.body.playerStats.find((p) => p.id === doublesPlayers.DP4).eloRating;
  assert(dp1 === 1016 && dp2 === 1016, `both winning doubles partners gain the identical +16 (got ${dp1}, ${dp2})`);
  assert(dp3 === 984 && dp4 === 984, `both losing doubles partners drop the identical -16 (got ${dp3}, ${dp4})`);

  console.log(failures === 0 ? "\nALL PASSED" : `\n${failures} FAILURE(S)`);
  process.exit(failures === 0 ? 0 : 1);
};

run().catch((e) => {
  console.error("Unhandled error:", e);
  process.exit(1);
});
