process.env.DATABASE_URL = "postgresql://postgres:testpass@localhost:5432/scoremine_test";
process.env.JWT_SECRET = "test-secret-not-for-production";

import authHandler from "./api/auth/[action].js";
const signup = (req, res) => authHandler({ ...req, query: { ...req.query, action: "signup" } }, res);
const login = (req, res) => authHandler({ ...req, query: { ...req.query, action: "login" } }, res);
const authHandlerAction = (action) => (req, res) => authHandler({ ...req, query: { ...req.query, action } }, res);
const meAction = (req, res) => authHandler({ ...req, query: { ...req.query, action: "me" } }, res);
const forgotPassword = (req, res) => authHandler({ ...req, query: { ...req.query, action: "forgot-password" } }, res);
const resetPassword = (req, res) => authHandler({ ...req, query: { ...req.query, action: "reset-password" } }, res);
import groupsIndex from "./api/groups/index.js";
import groupShow from "./api/groups/[id]/index.js";
import membersIndex from "./api/groups/[id]/members/index.js";
import memberDelete from "./api/groups/[id]/members/[memberId].js";
import gamesIndex from "./api/groups/[id]/games/index.js";
import gameDetail from "./api/games/[id].js";
import analyticsHandler from "./api/groups/[id]/analytics.js";
import meHandler from "./api/me.js";
import tournamentsIndex from "./api/groups/[id]/tournaments/index.js";
import tournamentDetail from "./api/tournaments/[...path].js";
import adminHandler from "./api/admin/[...path].js";
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

async function call(handler, { method = "GET", query = {}, body, cookie, url } = {}) {
  const req = { method, query, body, url, headers: cookie ? { cookie } : {} };
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

  // --- Admin can now ALSO invite into a group they don't own (reversed
  // from an earlier requirement that restricted this to owner-only) ---
  r = await call(membersIndex, {
    method: "POST",
    query: { id: weiGroupId },
    body: { name: "Admin Invite", email: "adminintrude@example.com" },
    cookie: dilanCookie, // dilan is admin, not owner of wei's group
  });
  assert(r.status === 201, "admin can invite members into a group they don't own");
  const adminInviteId = r.body.id;

  // Owner can still invite into their own group too
  r = await call(membersIndex, {
    method: "POST",
    query: { id: weiGroupId },
    body: { name: "Legit Invite", email: "legit@example.com" },
    cookie: weiCookie,
  });
  assert(r.status === 201, "owner can invite members into their own group");
  const legitInviteId = r.body.id;

  // --- Admin can now ALSO remove members from a group they don't own ---
  r = await call(memberDelete, {
    method: "DELETE",
    query: { id: weiGroupId, memberId: adminInviteId },
    cookie: dilanCookie, // dilan is admin, not owner of wei's group
  });
  assert(r.status === 204, "admin can remove members from a group they don't own");

  // Owner can still remove members from their own group too
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

  // ============================================================
  // Editing a logged game (GET single game, PATCH to edit)
  // ============================================================
  r = await call(groupsIndex, { method: "POST", body: { name: "Edit Test Club" }, cookie: dilanCookie });
  const editGroupId = r.body.id;
  const editPlayers = {};
  for (const [name, email] of [
    ["EditP1", "editp1@example.com"],
    ["EditP2", "editp2@example.com"],
    ["EditP3", "editp3@example.com"],
  ]) {
    r = await call(membersIndex, { method: "POST", query: { id: editGroupId }, body: { name, email }, cookie: dilanCookie });
    editPlayers[name] = r.body.id;
  }

  r = await call(gamesIndex, {
    method: "POST",
    query: { id: editGroupId },
    cookie: dilanCookie,
    body: {
      match_type: "singles",
      played_at: "2026-02-01",
      side1: [editPlayers.EditP1],
      side2: [editPlayers.EditP2],
      sets: [{ side1_score: 21, side2_score: 19 }],
    },
  });
  const editGameId = r.body.id;

  // Non-member can't view or edit
  r = await call(gameDetail, { method: "GET", query: { id: editGameId }, cookie: weiCookie });
  assert(r.status === 404, "non-member gets 404 viewing a game in a group they can't see");
  r = await call(gameDetail, {
    method: "PATCH",
    query: { id: editGameId },
    cookie: weiCookie,
    body: { match_type: "singles", played_at: "2026-02-01", side1: [editPlayers.EditP1], side2: [editPlayers.EditP2], sets: [{ side1_score: 21, side2_score: 19 }] },
  });
  assert(r.status === 404, "non-member gets 404 editing a game in a group they can't see");

  // Fetch it back and verify shape
  r = await call(gameDetail, { method: "GET", query: { id: editGameId }, cookie: dilanCookie });
  assert(r.status === 200 && r.body.side1[0].id === editPlayers.EditP1, "GET single game returns full detail with player names");
  assert(r.body.winner_side === 1, "winner_side computed correctly on the original game");

  // Edit: flip the result (P2 actually won) and change the score
  r = await call(gameDetail, {
    method: "PATCH",
    query: { id: editGameId },
    cookie: dilanCookie,
    body: {
      match_type: "singles",
      played_at: "2026-02-01",
      side1: [editPlayers.EditP1],
      side2: [editPlayers.EditP2],
      sets: [{ side1_score: 15, side2_score: 21 }],
    },
  });
  assert(r.status === 200 && r.body.winner_side === 2, "editing a game recomputes winner_side from the new scores");

  r = await call(analyticsHandler, { method: "GET", query: { id: editGroupId }, cookie: dilanCookie });
  let editP1Stats = r.body.playerStats.find((p) => p.id === editPlayers.EditP1);
  let editP2Stats = r.body.playerStats.find((p) => p.id === editPlayers.EditP2);
  assert(editP1Stats.losses === 1 && editP1Stats.wins === 0, "analytics reflects the edited (flipped) result, not the original");
  assert(editP2Stats.wins === 1 && editP2Stats.losses === 0, "the other player's record flips correspondingly");

  // Edit: change the actual lineup entirely (swap opponent from P2 to P3)
  r = await call(gameDetail, {
    method: "PATCH",
    query: { id: editGameId },
    cookie: dilanCookie,
    body: {
      match_type: "singles",
      played_at: "2026-02-01",
      side1: [editPlayers.EditP1],
      side2: [editPlayers.EditP3],
      sets: [{ side1_score: 21, side2_score: 10 }],
    },
  });
  assert(r.status === 200, "editing to swap the lineup entirely succeeds");
  r = await call(analyticsHandler, { method: "GET", query: { id: editGroupId }, cookie: dilanCookie });
  assert(
    !r.body.playerStats.some((p) => p.id === editPlayers.EditP2 && p.games > 0),
    "the old opponent (P2) no longer shows any games for this match after the lineup changed"
  );
  const editP3Stats = r.body.playerStats.find((p) => p.id === editPlayers.EditP3);
  assert(editP3Stats.losses === 1, "the new opponent (P3) now shows the loss instead");

  // Can't edit to include a non-member player
  r = await call(gameDetail, {
    method: "PATCH",
    query: { id: editGameId },
    cookie: dilanCookie,
    body: {
      match_type: "singles",
      played_at: "2026-02-01",
      side1: [editPlayers.EditP1],
      side2: [weiId], // not a member of this group
      sets: [{ side1_score: 21, side2_score: 10 }],
    },
  });
  assert(r.status === 400, "can't edit a game to include a non-member player");

  // Non-owner member CAN edit (canLogGames covers member, not just owner)
  await call(membersIndex, { method: "POST", query: { id: editGroupId }, body: { name: "Priya", email: "priya@example.com" }, cookie: dilanCookie });
  r = await call(gameDetail, {
    method: "PATCH",
    query: { id: editGameId },
    cookie: priyaCookie,
    body: {
      match_type: "singles",
      played_at: "2026-02-02",
      side1: [editPlayers.EditP1],
      side2: [editPlayers.EditP3],
      sets: [{ side1_score: 21, side2_score: 5 }],
    },
  });
  assert(r.status === 200, "a regular member (not just the owner) can edit a game");

  // Delete still works
  r = await call(gameDetail, { method: "DELETE", query: { id: editGameId }, cookie: dilanCookie });
  assert(r.status === 204, "delete still works via the same endpoint");
  r = await call(analyticsHandler, { method: "GET", query: { id: editGroupId }, cookie: dilanCookie });
  assert(r.body.totalGames === 0, "analytics shows 0 games after the only game is deleted");

  // ============================================================
  // /api/me -- personal cross-group stats, head-to-head, partners
  // ============================================================
  r = await call(meHandler, { method: "GET", cookie: weiCookie });
  // wei has no groups yet at this point in isolation -- but wei DID create "Wei's Solo Group" earlier
  // and "Elo Doubles Test" wasn't theirs, so just sanity check the shape rather than exact zeros.
  assert(r.status === 200 && Array.isArray(r.body.groups), "/api/me returns 200 with a groups array for any authenticated user");

  // Build a clean, isolated scenario: two players, two groups, shared opponent
  r = await call(signup, { method: "POST", body: { name: "MeTestA", email: "metesta@example.com", password: "password123" } });
  const meACookie = r.cookie;
  const meAId = r.body.id;
  r = await call(signup, { method: "POST", body: { name: "MeTestB", email: "metestb@example.com", password: "password123" } });
  const meBCookie = r.cookie;
  const meBId = r.body.id;
  r = await call(signup, { method: "POST", body: { name: "MeTestC", email: "metestc@example.com", password: "password123" } });
  const meCId = r.body.id;

  // Group 1: A beats B twice (singles) -- also makes A and B doubles partners in one game vs C+someone... keep simple: two groups.
  r = await call(groupsIndex, { method: "POST", body: { name: "MeTest Group 1" }, cookie: meACookie });
  const meGroup1 = r.body.id;
  await call(membersIndex, { method: "POST", query: { id: meGroup1 }, body: { name: "MeTestB", email: "metestb@example.com" }, cookie: meACookie });
  await call(membersIndex, { method: "POST", query: { id: meGroup1 }, body: { name: "MeTestC", email: "metestc@example.com" }, cookie: meACookie });

  await call(gamesIndex, {
    method: "POST", query: { id: meGroup1 }, cookie: meACookie,
    body: { match_type: "singles", played_at: "2026-03-01", side1: [meAId], side2: [meBId], sets: [{ side1_score: 21, side2_score: 15 }] },
  });
  // Doubles: A+B vs C+A? no -- need 4 distinct players for doubles. Use A+C vs B+ (need a 4th). Skip doubles here, do it in group 2 instead.

  // Group 2: A partners with C in doubles against B + a 4th; also A faces B again in singles (head-to-head accumulates ACROSS groups)
  r = await call(groupsIndex, { method: "POST", body: { name: "MeTest Group 2" }, cookie: meACookie });
  const meGroup2 = r.body.id;
  await call(membersIndex, { method: "POST", query: { id: meGroup2 }, body: { name: "MeTestB", email: "metestb@example.com" }, cookie: meACookie });
  await call(membersIndex, { method: "POST", query: { id: meGroup2 }, body: { name: "MeTestC", email: "metestc@example.com" }, cookie: meACookie });
  r = await call(signup, { method: "POST", body: { name: "MeTestD", email: "metestd@example.com", password: "password123" } });
  const meDId = r.body.id;
  await call(membersIndex, { method: "POST", query: { id: meGroup2 }, body: { name: "MeTestD", email: "metestd@example.com" }, cookie: meACookie });

  // A beats B again in singles (2nd meeting overall, still A leads 2-0 head-to-head)
  await call(gamesIndex, {
    method: "POST", query: { id: meGroup2 }, cookie: meACookie,
    body: { match_type: "singles", played_at: "2026-03-05", side1: [meAId], side2: [meBId], sets: [{ side1_score: 21, side2_score: 18 }] },
  });
  // Doubles: A+C beat B+D -- A and C become partners with a win together
  await call(gamesIndex, {
    method: "POST", query: { id: meGroup2 }, cookie: meACookie,
    body: { match_type: "doubles", played_at: "2026-03-06", side1: [meAId, meCId], side2: [meBId, meDId], sets: [{ side1_score: 21, side2_score: 12 }] },
  });

  r = await call(meHandler, { method: "GET", cookie: meACookie });
  assert(r.status === 200, "/api/me returns 200 for MeTestA");
  assert(r.body.totalGames === 3, "MeTestA's total games combines both groups (2 singles + 1 doubles = 3)");
  assert(r.body.wins === 3 && r.body.losses === 0, "MeTestA is 3-0 overall across both groups");
  assert(r.body.groups.length === 2, "MeTestA's group breakdown lists both groups");
  const g1 = r.body.groups.find((g) => g.id === meGroup1);
  const g2 = r.body.groups.find((g) => g.id === meGroup2);
  assert(g1.wins === 1 && g1.games === 1, "per-group breakdown: 1 game in group 1");
  assert(g2.wins === 2 && g2.games === 2, "per-group breakdown: 2 games in group 2");

  const h2hVsB = r.body.headToHead.find((h) => h.id === meBId);
  // 3 meetings total: 2 singles wins PLUS the doubles game (A+C vs B+D) --
  // B is on the opposing side there too, so it counts as a 3rd head-to-head
  // meeting even though it's not a 1-on-1 match. This is deliberate: any
  // game where two players were on opposite sides counts, doubles included.
  assert(
    h2hVsB.wins === 3 && h2hVsB.losses === 0,
    `head-to-head vs MeTestB is 3-0 (2 singles + 1 doubles), AGGREGATED ACROSS BOTH GROUPS (got ${h2hVsB.wins}-${h2hVsB.losses})`
  );
  const h2hVsD = r.body.headToHead.find((h) => h.id === meDId);
  assert(h2hVsD.wins === 1 && h2hVsD.losses === 0, "head-to-head vs MeTestD (only faced once, in doubles) is 1-0");
  const partnerC = r.body.partners.find((p) => p.id === meCId);
  assert(partnerC.wins === 1 && partnerC.losses === 0, "partner record with MeTestC (doubles teammate) is 1-0");
  assert(
    !r.body.partners.some((p) => p.id === meBId),
    "MeTestB appears in head-to-head (opponent) but NOT in partners (never teamed up)"
  );

  // From B's perspective, the head-to-head should mirror exactly
  r = await call(meHandler, { method: "GET", cookie: meBCookie });
  const h2hVsA = r.body.headToHead.find((h) => h.id === meAId);
  assert(
    h2hVsA.wins === 0 && h2hVsA.losses === 3,
    `from MeTestB's side, the exact same head-to-head is 0-3, mirrored correctly (got ${h2hVsA.wins}-${h2hVsA.losses})`
  );

  // ============================================================
  // Tournaments: creation, fixture generation, results, standings,
  // the "real game" integration, and the public shareable link
  // ============================================================
  r = await call(groupsIndex, { method: "POST", body: { name: "Tournament Club" }, cookie: dilanCookie });
  const tGroupId = r.body.id;
  const tPlayers = {};
  for (const [name, email] of [
    ["TourneyP1", "tp1@example.com"],
    ["TourneyP2", "tp2@example.com"],
    ["TourneyP3", "tp3@example.com"],
    ["TourneyP4", "tp4@example.com"],
  ]) {
    r = await call(membersIndex, { method: "POST", query: { id: tGroupId }, body: { name, email }, cookie: dilanCookie });
    tPlayers[name] = r.body.id;
  }
  // Add priya as a plain member (not owner) to test permission boundaries
  await call(membersIndex, { method: "POST", query: { id: tGroupId }, body: { name: "Priya", email: "priya@example.com" }, cookie: dilanCookie });

  // Non-owner member can't create a tournament
  r = await call(tournamentsIndex, {
    method: "POST", query: { id: tGroupId }, cookie: priyaCookie,
    body: { name: "Should Fail", match_type: "singles", entries: [[tPlayers.TourneyP1], [tPlayers.TourneyP2]] },
  });
  assert(r.status === 403, "non-owner member cannot create a tournament");

  // Owner creates a 4-player singles round-robin
  r = await call(tournamentsIndex, {
    method: "POST", query: { id: tGroupId }, cookie: dilanCookie,
    body: {
      name: "Spring Singles",
      match_type: "singles",
      entries: [[tPlayers.TourneyP1], [tPlayers.TourneyP2], [tPlayers.TourneyP3], [tPlayers.TourneyP4]],
    },
  });
  assert(r.status === 201 && r.body.status === "draft", "tournament created in draft status");
  assert(r.body.public_slug && r.body.public_slug.length > 8, "tournament gets a public slug");
  const tournamentId = r.body.id;
  const publicSlug = r.body.public_slug;

  // Routing robustness: same bare-string-vs-array concern as the admin
  // handler -- confirm a single-segment tournament id works when Vercel
  // sends it as a plain string, not wrapped in an array.
  r = await call(tournamentDetail, { method: "GET", cookie: dilanCookie, query: { path: String(tournamentId) } });
  assert(r.status === 200 && r.body.id === tournamentId, "tournament path handler works when Vercel sends path as a bare string, not array-wrapped");
  r = await call(tournamentDetail, { method: "GET", cookie: dilanCookie, url: `/api/tournaments/${tournamentId}`, query: {} });
  assert(r.status === 200 && r.body.id === tournamentId, "tournament detail resolves from the real request URL alone");
  r = await call(tournamentDetail, { method: "GET", cookie: dilanCookie, query: { path: `${tournamentId}/fixtures/1` } });
  assert(r.status === 405, "tournament multi-segment path as ONE slash-joined string is parsed (GET on /fixtures/:id is 405, not a misrouted 404)");

  // Rejects a player who isn't a group member
  r = await call(tournamentsIndex, {
    method: "POST", query: { id: tGroupId }, cookie: dilanCookie,
    body: { name: "Bad", match_type: "singles", entries: [[tPlayers.TourneyP1], [weiId]] },
  });
  assert(r.status === 400, "tournament creation rejects a non-member player");

  // Rejects a player appearing in two entries
  r = await call(tournamentsIndex, {
    method: "POST", query: { id: tGroupId }, cookie: dilanCookie,
    body: { name: "Bad2", match_type: "singles", entries: [[tPlayers.TourneyP1], [tPlayers.TourneyP1]] },
  });
  assert(r.status === 400, "tournament creation rejects a player entered twice");

  // List tournaments for the group
  r = await call(tournamentsIndex, { method: "GET", query: { id: tGroupId }, cookie: dilanCookie });
  assert(r.status === 200 && r.body.some((t) => t.id === tournamentId), "group tournament list includes the new one");

  // Non-owner member can't generate fixtures
  r = await call(tournamentDetail, { method: "POST", query: { path: [String(tournamentId)] }, cookie: priyaCookie });
  assert(r.status === 403, "non-owner member cannot generate fixtures");

  // Owner generates fixtures: 4 players -> 3 rounds, 6 total matches (round-robin)
  r = await call(tournamentDetail, { method: "POST", query: { path: [String(tournamentId)] }, cookie: dilanCookie });
  assert(r.status === 200 && r.body.status === "in_progress", "generating fixtures moves the tournament to in_progress");
  assert(r.body.fixtures.length === 6, `4-player round robin produces 6 fixtures (got ${r.body.fixtures.length})`);
  assert(new Set(r.body.fixtures.map((f) => f.round)).size === 3, "6 fixtures span exactly 3 rounds");
  assert(r.body.fixtures.every((f) => !f.played), "no fixtures are marked played yet");

  // Can't generate fixtures twice
  r = await call(tournamentDetail, { method: "POST", query: { path: [String(tournamentId)] }, cookie: dilanCookie });
  assert(r.status === 409, "cannot regenerate fixtures once already generated");

  // Authenticated detail view requires group access
  r = await call(tournamentDetail, { method: "GET", query: { path: [String(tournamentId)] } }); // no cookie
  assert(r.status === 401, "viewing tournament detail by numeric id with no session is rejected");
  r = await call(tournamentDetail, { method: "GET", query: { path: [String(tournamentId)] }, cookie: weiCookie });
  assert(r.status === 404, "non-member gets 404 on tournament detail (no existence leak)");

  // Record a result -- a regular member (not the owner) can do this
  r = await call(tournamentDetail, { method: "GET", query: { path: [String(tournamentId)] }, cookie: dilanCookie });
  const fixtureToPlay = r.body.fixtures[0];
  r = await call(tournamentDetail, {
    method: "POST",
    query: { path: [String(tournamentId), "fixtures", String(fixtureToPlay.id)] },
    cookie: priyaCookie, // a member, not the owner
    body: { played_at: "2026-04-01", sets: [{ side1_score: 21, side2_score: 15 }] },
  });
  assert(r.status === 200, "a regular member can record a fixture result");
  const playedFixture = r.body.fixtures.find((f) => f.id === fixtureToPlay.id);
  assert(playedFixture.played === true && playedFixture.winnerEntryId != null, "fixture is now marked played with a winner");

  // THE KEY INTEGRATION: this created a REAL game that shows up in the
  // group's normal game list and counts in normal analytics.
  r = await call(gamesIndex, { method: "GET", query: { id: tGroupId }, cookie: dilanCookie });
  assert(r.body.length === 1, "the tournament result created a real row in the group's normal game history");
  r = await call(analyticsHandler, { method: "GET", query: { id: tGroupId }, cookie: dilanCookie });
  assert(r.body.totalGames === 1, "the tournament result counts in the group's normal analytics too");

  // Re-recording a result replaces the game rather than duplicating it
  r = await call(tournamentDetail, {
    method: "POST",
    query: { path: [String(tournamentId), "fixtures", String(fixtureToPlay.id)] },
    cookie: dilanCookie,
    body: { played_at: "2026-04-01", sets: [{ side1_score: 10, side2_score: 21 }] }, // flip the result
  });
  const refetchedFixture = r.body.fixtures.find((f) => f.id === fixtureToPlay.id);
  assert(
    refetchedFixture.winnerEntryId !== playedFixture.winnerEntryId,
    "re-recording a fixture's result actually changes the winner, not just adds a duplicate"
  );
  r = await call(gamesIndex, { method: "GET", query: { id: tGroupId }, cookie: dilanCookie });
  assert(r.body.length === 1, "re-recording replaced the old game rather than leaving a stale duplicate behind");

  // Play out the rest of the tournament to test auto-completion
  r = await call(tournamentDetail, { method: "GET", query: { path: [String(tournamentId)] }, cookie: dilanCookie });
  const remainingFixtures = r.body.fixtures.filter((f) => !f.played);
  for (const f of remainingFixtures) {
    r = await call(tournamentDetail, {
      method: "POST",
      query: { path: [String(tournamentId), "fixtures", String(f.id)] },
      cookie: dilanCookie,
      body: { played_at: "2026-04-02", sets: [{ side1_score: 21, side2_score: 12 }] },
    });
  }
  assert(r.body.status === "completed", "tournament auto-completes once every fixture has a recorded result");
  assert(r.body.standings.every((s) => s.games === 3), "every entry's standings show 3 games played (round robin of 4)");
  assert(
    r.body.standings.every((s, i) => i === 0 || r.body.standings[i - 1].wins >= s.wins),
    "standings are sorted by wins, descending"
  );

  // THE PUBLIC LINK: fetch by slug with absolutely no cookie at all
  r = await call(tournamentDetail, { method: "GET", query: { path: [publicSlug] } }); // no cookie, no auth
  assert(r.status === 200, "the public slug is viewable with zero authentication");
  assert(r.body.name === "Spring Singles" && r.body.standings.length === 4, "public view shows the same tournament data");

  // A doubles tournament: entries are pairs, not individuals
  r = await call(tournamentsIndex, {
    method: "POST", query: { id: tGroupId }, cookie: dilanCookie,
    body: {
      name: "Doubles Cup",
      match_type: "doubles",
      entries: [
        [tPlayers.TourneyP1, tPlayers.TourneyP2],
        [tPlayers.TourneyP3, tPlayers.TourneyP4],
      ],
    },
  });
  assert(r.status === 201, "doubles tournament creation succeeds with paired entries");
  const doublesTournamentId = r.body.id;
  r = await call(tournamentDetail, { method: "POST", query: { path: [String(doublesTournamentId)] }, cookie: dilanCookie });
  assert(r.body.fixtures.length === 1, "2 doubles entries produce exactly 1 fixture");
  assert(
    r.body.entries.every((e) => e.name.includes("&")),
    "doubles entry display names join both partners with '&'"
  );

  // ============================================================
  // Super admin panel: user list/create/update/delete, group
  // create/rename/transfer, and the safety guards around deletion
  // ============================================================
  const adminPath = (segments, opts) => call(adminHandler, { ...opts, query: { path: segments } });
  const dilanId = (await call(meAction, { cookie: dilanCookie })).body.id;

  // --- Routing robustness: Vercel can send a single-segment catch-all
  // param as a bare string ("users") instead of a one-item array
  // (["users"]) -- every OTHER test here passes a proper array, which
  // would never have caught this. Explicitly test the bare-string shape
  // since that's what broke in production.
  r = await call(adminHandler, { method: "GET", cookie: dilanCookie, query: { path: "users" } });
  assert(r.status === 200 && Array.isArray(r.body), "admin path handler works when Vercel sends path as a bare string, not array-wrapped");

  // Every shape the platform might plausibly hand us for the SAME request:
  const shapes = [
    ["real request URL, empty query", { url: "/api/admin/users", query: {} }],
    ["real request URL with a query string", { url: "/api/admin/users?x=1", query: {} }],
    ["array query param", { query: { path: ["users"] } }],
    ["internal rewritten URL + string query (URL must be ignored)", { url: "/api/admin/[...path]?path=users", query: { path: "users" } }],
    ["'...path' key", { query: { "...path": "users" } }],
  ];
  for (const [label, opts] of shapes) {
    r = await call(adminHandler, { method: "GET", cookie: dilanCookie, ...opts });
    assert(r.status === 200 && Array.isArray(r.body), `admin GET /users resolves when platform sends: ${label}`);
  }
  // Multi-segment: slash-joined string is a real possibility, and was silently broken before
  const anyUser = (await call(adminHandler, { method: "GET", cookie: dilanCookie, query: { path: "users" } })).body[0];
  r = await call(adminHandler, { method: "PATCH", cookie: dilanCookie, query: { path: `users/${anyUser.id}` }, body: { name: anyUser.name } });
  assert(r.status === 200, "admin PATCH /users/:id resolves when multi-segment path arrives as ONE slash-joined string");
  r = await call(adminHandler, { method: "PATCH", cookie: dilanCookie, url: `/api/admin/users/${anyUser.id}`, query: {}, body: { name: anyUser.name } });
  assert(r.status === 200, "admin PATCH /users/:id resolves from the real request URL alone");
  // And a genuinely unknown route still 404s, now with a diagnosable message
  r = await call(adminHandler, { method: "GET", cookie: dilanCookie, url: "/api/admin/nonsense", query: {} });
  assert(r.status === 404 && r.body.error.includes("parsed="), "unknown admin route 404s and reports what it received");
  const priyaId = (await call(meAction, { cookie: priyaCookie })).body.id;

  // --- Auth boundary: non-admin gets 403, not just a silent empty result ---
  r = await adminPath(["users"], { method: "GET", cookie: priyaCookie });
  assert(r.status === 403, "non-admin gets 403 listing users");
  r = await adminPath(["users"], { method: "GET" }); // no cookie at all
  assert(r.status === 401, "no session at all gets 401, not 403");

  // --- List users: admin sees everyone, including people they've never interacted with ---
  r = await call(signup, { method: "POST", body: { name: "Stranger", email: "stranger@example.com", password: "password123" } });
  const strangerId = r.body.id;
  const strangerCookie = r.cookie;
  r = await adminPath(["users"], { method: "GET", cookie: dilanCookie });
  assert(r.status === 200, "admin can list all users");
  assert(r.body.some((u) => u.id === strangerId), "the user list includes someone dilan has never interacted with");
  const strangerRow = r.body.find((u) => u.id === strangerId);
  assert(strangerRow.games_played === 0 && strangerRow.groups_owned === 0, "user list includes per-user activity counts");

  // --- Create a user (admin invite-style, upsert by email) ---
  r = await adminPath(["users"], { method: "POST", cookie: dilanCookie, body: { name: "Admin Created", email: "admincreated@example.com" } });
  assert(r.status === 201 && r.body.has_joined === false, "admin can create a placeholder user (not yet signed up)");
  const adminCreatedId = r.body.id;

  // Creating with an existing email links instead of erroring/duplicating
  r = await adminPath(["users"], { method: "POST", cookie: dilanCookie, body: { name: "Dup Attempt", email: "admincreated@example.com" } });
  assert(r.status === 201 && r.body.id === adminCreatedId, "creating a user with an existing email links to the same account, not a duplicate");

  // --- Update a user ---
  r = await adminPath(["users", String(strangerId)], { method: "PATCH", cookie: dilanCookie, body: { name: "Renamed Stranger" } });
  assert(r.status === 200 && r.body.name === "Renamed Stranger", "admin can rename a user");

  // --- Promote / demote ---
  r = await adminPath(["users", String(strangerId)], { method: "PATCH", cookie: dilanCookie, body: { is_admin: true } });
  assert(r.status === 200 && r.body.is_admin === true, "admin can promote another user to admin");

  // Now there are 2 admins (dilan + stranger) -- dilan can safely demote himself
  r = await adminPath(["users", String(dilanId)], { method: "PATCH", cookie: dilanCookie, body: { is_admin: false } });
  assert(r.status === 200 && r.body.is_admin === false, "admin can demote themselves IF another admin still exists");

  // dilan is no longer admin, so use STRANGER's session (still admin) to
  // re-promote him -- this is also a real-world sanity check, not just
  // convenient test plumbing: it confirms a demoted admin genuinely can't
  // self-service their way back in.
  r = await adminPath(["users", String(dilanId)], { method: "PATCH", cookie: dilanCookie, body: { is_admin: true } });
  assert(r.status === 403, "a demoted (non-admin) user can't use admin endpoints, even to re-promote themselves");
  await adminPath(["users", String(dilanId)], { method: "PATCH", cookie: strangerCookie, body: { is_admin: true } });

  // Demote stranger back down, leaving dilan as the sole admin again
  r = await adminPath(["users", String(strangerId)], { method: "PATCH", cookie: dilanCookie, body: { is_admin: false } });
  assert(r.status === 200, "admin can demote a different admin");
  // Now dilan is the ONLY admin -- self-demotion must be blocked
  r = await adminPath(["users", String(dilanId)], { method: "PATCH", cookie: dilanCookie, body: { is_admin: false } });
  assert(r.status === 409, "the last remaining admin cannot demote themselves (would lock everyone out)");

  // --- STALE SESSION CHECK: demoted admin's existing token stops working immediately ---
  r = await call(signup, { method: "POST", body: { name: "TempAdmin", email: "tempadmin@example.com", password: "password123" } });
  const tempAdminCookie = r.cookie;
  const tempAdminId = r.body.id;
  await adminPath(["users", String(tempAdminId)], { method: "PATCH", cookie: dilanCookie, body: { is_admin: true } });
  r = await adminPath(["users"], { method: "GET", cookie: tempAdminCookie });
  assert(r.status === 200, "newly-promoted admin's existing session cookie works immediately (re-checks DB, not a stale claim)");
  await adminPath(["users", String(tempAdminId)], { method: "PATCH", cookie: dilanCookie, body: { is_admin: false } });
  r = await adminPath(["users"], { method: "GET", cookie: tempAdminCookie });
  assert(r.status === 403, "demoted admin's OLD session cookie is rejected immediately -- proves this re-checks the DB, not the JWT's stale claim");

  // --- Deletion safety guards ---
  // Can't delete a user who owns a group
  r = await adminPath(["users", String(meAId)], { method: "DELETE", cookie: dilanCookie }); // meAId owns groups from earlier tests
  assert(r.status === 409 && r.body.error.includes("owns"), "cannot delete a user who owns a group");

  // Can't delete a user with game history
  r = await adminPath(["users", String(meBId)], { method: "DELETE", cookie: dilanCookie }); // meBId has played games from earlier tests
  assert(r.status === 409 && r.body.error.includes("game"), "cannot delete a user who has played logged games");

  // CAN delete a clean user (no groups owned, no games played)
  r = await adminPath(["users", String(adminCreatedId)], { method: "DELETE", cookie: dilanCookie });
  assert(r.status === 204, "CAN delete a clean user with no groups owned and no game history");
  r = await adminPath(["users"], { method: "GET", cookie: dilanCookie });
  assert(!r.body.some((u) => u.id === adminCreatedId), "deleted user no longer appears in the user list");

  // --- Groups: create on behalf of a specific owner, rename, transfer ---
  r = await adminPath(["groups"], { method: "POST", cookie: dilanCookie, body: { name: "Admin-Made Group", owner_id: strangerId } });
  assert(r.status === 201 && r.body.owner_id === strangerId, "admin can create a group with a specified (non-admin) owner");
  const adminMadeGroupId = r.body.id;

  r = await call(membersIndex, { method: "GET", query: { id: adminMadeGroupId }, cookie: dilanCookie });
  assert(r.body.some((m) => m.id === strangerId), "the specified owner was auto-added as a member of their new group");

  r = await adminPath(["groups", String(adminMadeGroupId)], { method: "PATCH", cookie: dilanCookie, body: { name: "Renamed By Admin" } });
  assert(r.status === 200 && r.body.name === "Renamed By Admin", "admin can rename any group");

  r = await adminPath(["groups", String(adminMadeGroupId)], { method: "PATCH", cookie: dilanCookie, body: { owner_id: meAId } });
  assert(r.status === 200 && r.body.owner_id === meAId, "admin can transfer group ownership to a different user");
  r = await call(membersIndex, { method: "GET", query: { id: adminMadeGroupId }, cookie: dilanCookie });
  assert(r.body.some((m) => m.id === meAId), "the new owner was auto-added as a member after the ownership transfer");

  // Non-admin cannot use any admin group endpoints either
  r = await adminPath(["groups"], { method: "POST", cookie: priyaCookie, body: { name: "Should Fail", owner_id: priyaId } });
  assert(r.status === 403, "non-admin cannot create a group via the admin endpoint");

  // --- Admin password reset: explicit password, and generated temp password ---
  r = await call(signup, { method: "POST", body: { name: "ResetMe", email: "resetme@example.com", password: "originalpass1" } });
  const resetMeId = r.body.id;

  // Explicit new password
  r = await adminPath(["users", String(resetMeId)], { method: "PATCH", cookie: dilanCookie, body: { password: "adminsetpass1" } });
  assert(r.status === 200 && r.body.generatedPassword === undefined, "setting an explicit password doesn't return a generatedPassword");
  r = await call(login, { method: "POST", body: { email: "resetme@example.com", password: "originalpass1" } });
  assert(r.status === 401, "old password no longer works after admin sets a new one");
  r = await call(login, { method: "POST", body: { email: "resetme@example.com", password: "adminsetpass1" } });
  assert(r.status === 200, "the admin-set password works for login");

  // Generated temp password
  r = await adminPath(["users", String(resetMeId)], { method: "PATCH", cookie: dilanCookie, body: { reset_password: true } });
  assert(r.status === 200 && typeof r.body.generatedPassword === "string" && r.body.generatedPassword.length >= 8, "reset_password returns a generated temp password");
  const tempPassword = r.body.generatedPassword;
  r = await call(login, { method: "POST", body: { email: "resetme@example.com", password: "adminsetpass1" } });
  assert(r.status === 401, "the previous password stops working once a temp password is generated");
  r = await call(login, { method: "POST", body: { email: "resetme@example.com", password: tempPassword } });
  assert(r.status === 200, "the generated temp password actually works for login");

  // Too-short explicit password is rejected
  r = await adminPath(["users", String(resetMeId)], { method: "PATCH", cookie: dilanCookie, body: { password: "short" } });
  assert(r.status === 400, "admin-set password must still meet the 8-character minimum");

  // Non-admin can't reset anyone's password
  r = await adminPath(["users", String(resetMeId)], { method: "PATCH", cookie: priyaCookie, body: { reset_password: true } });
  assert(r.status === 403, "non-admin cannot reset another user's password");

  // --- Member management is no longer owner-exclusive: admin can too (reversed requirement) ---
  r = await call(groupShow, { method: "GET", query: { id: weiGroupId }, cookie: dilanCookie });
  assert(r.body.role === "admin", "sanity check: dilan's role on wei's group is admin, not owner, for this test to be meaningful");

  // ============================================================
  // Deactivation: block access WITHOUT deleting, for users who can't be
  // deleted (own groups / have game history). The two cases that motivated it:
  //   meB = has played logged games   meA = owns groups
  // ============================================================
  const meBId2 = meBId;
  const analyticsBefore = (await call(analyticsHandler, { method: "GET", query: { id: meGroup2 }, cookie: dilanCookie })).body;

  // Sanity: both are genuinely undeletable, i.e. the situation we're solving
  r = await adminPath(["users", String(meBId2)], { method: "DELETE", cookie: dilanCookie });
  assert(r.status === 409 && r.body.error.includes("Deactivate"), "delete is refused for a user with game history, and the error points at deactivation");
  r = await adminPath(["users", String(meAId)], { method: "DELETE", cookie: dilanCookie });
  assert(r.status === 409 && r.body.error.includes("deactivate"), "delete is refused for a group owner, and the error points at deactivation");

  // Their sessions work right now
  r = await call(groupsIndex, { method: "GET", cookie: meBCookie });
  assert(r.status === 200, "before deactivation, the user's session works normally");

  // Access control on the feature itself
  r = await adminPath(["users", String(meBId2)], { method: "PATCH", cookie: priyaCookie, body: { is_active: false } });
  assert(r.status === 403, "non-admin cannot deactivate anyone");
  r = await adminPath(["users", String(dilanId)], { method: "PATCH", cookie: dilanCookie, body: { is_active: false } });
  assert(r.status === 409, "an admin cannot deactivate their own account");

  // Issue a password-reset token BEFORE deactivation, to test it can't be used afterwards
  await call(authHandlerAction("forgot-password"), { method: "POST", body: { email: "metestb@example.com" } });
  const { rows: preTokens } = await getPool().query(
    "SELECT token FROM password_reset_tokens WHERE user_id = $1 ORDER BY expires_at DESC LIMIT 1", [meBId2]);
  const meBResetToken = preTokens[0].token;

  // --- Deactivate the user with game history ---
  r = await adminPath(["users", String(meBId2)], { method: "PATCH", cookie: dilanCookie, body: { is_active: false } });
  assert(r.status === 200 && r.body.is_active === false, "admin can deactivate a user who has game history");

  // The existing session dies on the very next request (this is the part a JWT alone can't do)
  r = await call(groupsIndex, { method: "GET", cookie: meBCookie });
  assert(r.status === 401 && r.body.error.includes("deactivated"), "their EXISTING session is rejected immediately, with a clear reason");
  r = await call(meAction, { method: "GET", cookie: meBCookie });
  assert(r.status === 401, "the auth 'who am I' check reads as logged out, so the frontend sends them to login");
  r = await call(tournamentDetail, { method: "GET", cookie: meBCookie, query: { path: String(tournamentId) } });
  assert(r.status === 401, "the tournament routes (which handle auth separately) reject them too");

  // Can't log back in -- even with the CORRECT password
  r = await call(login, { method: "POST", body: { email: "metestb@example.com", password: "password123" } });
  assert(r.status === 403 && r.body.error.includes("deactivated") && !r.cookie, "login is refused with the correct password, and no session cookie is issued");
  // ...but doesn't leak anything to someone with the WRONG password
  r = await call(login, { method: "POST", body: { email: "metestb@example.com", password: "wrong-password" } });
  assert(r.status === 401 && r.body.error === "Invalid email or password", "a wrong password still gets the generic error -- deactivation isn't revealed to someone without the credentials");

  // The password-reset back door must be shut too (a successful reset logs you in)
  r = await call(resetPassword, { method: "POST", body: { token: meBResetToken, password: "brandnewpass1" } });
  assert(r.status === 403 && !r.cookie, "a reset token issued before deactivation can't be used to get back in");
  const { rows: tokenCountBefore } = await getPool().query("SELECT COUNT(*)::int AS n FROM password_reset_tokens WHERE user_id = $1", [meBId2]);
  await call(forgotPassword, { method: "POST", body: { email: "metestb@example.com" } });
  const { rows: tokenCountAfter } = await getPool().query("SELECT COUNT(*)::int AS n FROM password_reset_tokens WHERE user_id = $1", [meBId2]);
  assert(tokenCountAfter[0].n === tokenCountBefore[0].n, "forgot-password issues no new reset token for a deactivated account");

  // Nothing was deleted: history intact, still visible to the admin
  const analyticsAfter = (await call(analyticsHandler, { method: "GET", query: { id: meGroup2 }, cookie: dilanCookie })).body;
  assert(analyticsAfter.totalGames === analyticsBefore.totalGames, "their game history is untouched -- same game count as before");
  assert(analyticsAfter.playerStats.some((p) => p.id === meBId2), "they still appear in the group's standings");
  r = await adminPath(["users"], { method: "GET", cookie: dilanCookie });
  const meBRow = r.body.find((u) => u.id === meBId2);
  assert(meBRow && meBRow.is_active === false && meBRow.games_played > 0, "the admin user list shows them as deactivated, with their activity intact");

  // --- Reactivate: fully reversible, same password, old session works again ---
  r = await adminPath(["users", String(meBId2)], { method: "PATCH", cookie: dilanCookie, body: { is_active: true } });
  assert(r.status === 200 && r.body.is_active === true, "admin can reactivate them");
  r = await call(login, { method: "POST", body: { email: "metestb@example.com", password: "password123" } });
  assert(r.status === 200, "after reactivation they can log in again with their original password");
  r = await call(groupsIndex, { method: "GET", cookie: meBCookie });
  assert(r.status === 200, "...and even their OLD session cookie works again");

  // --- The other motivating case: a group OWNER ---
  r = await adminPath(["users", String(meAId)], { method: "PATCH", cookie: dilanCookie, body: { is_active: false } });
  assert(r.status === 200 && r.body.is_active === false, "admin can deactivate a group owner");
  r = await call(groupsIndex, { method: "GET", cookie: meACookie });
  assert(r.status === 401, "the deactivated owner is locked out");
  r = await call(groupShow, { method: "GET", query: { id: meGroup1 }, cookie: dilanCookie });
  assert(r.status === 200 && r.body.owner_name, "their group still exists and the admin can still see and manage it");
  r = await adminPath(["groups", String(meGroup1)], { method: "PATCH", cookie: dilanCookie, body: { owner_id: dilanId } });
  assert(r.status === 200 && r.body.owner_id === dilanId, "the admin can hand the group to someone else while the owner is deactivated");
  await adminPath(["groups", String(meGroup1)], { method: "PATCH", cookie: dilanCookie, body: { owner_id: meAId } });
  await adminPath(["users", String(meAId)], { method: "PATCH", cookie: dilanCookie, body: { is_active: true } });

  // --- A deactivated ADMIN loses admin powers too ---
  r = await call(signup, { method: "POST", body: { name: "DeactAdmin", email: "deactadmin@example.com", password: "password123" } });
  const deactAdminCookie = r.cookie;
  const deactAdminId = r.body.id;
  await adminPath(["users", String(deactAdminId)], { method: "PATCH", cookie: dilanCookie, body: { is_admin: true } });
  r = await adminPath(["users"], { method: "GET", cookie: deactAdminCookie });
  assert(r.status === 200, "sanity: the new admin can use the admin panel");
  await adminPath(["users", String(deactAdminId)], { method: "PATCH", cookie: dilanCookie, body: { is_active: false } });
  r = await adminPath(["users"], { method: "GET", cookie: deactAdminCookie });
  assert(r.status === 401, "a deactivated admin is locked out of the admin panel immediately");

  // ============================================================
  // Regression test: admin status must be re-checked against the
  // database, not trusted from a possibly-stale JWT claim baked in
  // at login. This reproduces the exact real bug: a user's session
  // token is issued BEFORE they're promoted to admin, and without
  // logging in again, their stale token must still be recognized as
  // admin on every subsequent request.
  // ============================================================
  r = await call(signup, { method: "POST", body: { name: "StaleTokenUser", email: "staletoken@example.com", password: "password123" } });
  const staleCookie = r.cookie; // issued while is_admin = false -- never refreshed after this point
  const staleUserId = r.body.id;
  assert(r.body.isAdmin === false, "StaleTokenUser's token is issued as a non-admin");

  // A group this user does NOT own and is NOT a member of.
  r = await call(groupsIndex, { method: "POST", body: { name: "Someone Else's Group" }, cookie: dilanCookie });
  const otherGroupId = r.body.id;

  // Confirm the stale token genuinely can't see it yet (not admin, not a member).
  r = await call(groupsIndex, { method: "GET", cookie: staleCookie });
  assert(!r.body.some((g) => g.id === otherGroupId), "before promotion, the stale-token user does NOT see someone else's group");
  r = await call(groupShow, { method: "GET", query: { id: otherGroupId }, cookie: staleCookie });
  assert(r.status === 404, "before promotion, the stale-token user gets 404 on someone else's group directly");

  // Promote them to admin -- WITHOUT them logging in again, so staleCookie
  // still has isAdmin: false baked into its JWT payload.
  await adminPath(["users", String(staleUserId)], { method: "PATCH", cookie: dilanCookie, body: { is_admin: true } });

  // The exact bug: with the OLD, never-refreshed cookie, do they now see everything?
  r = await call(groupsIndex, { method: "GET", cookie: staleCookie });
  assert(
    r.body.some((g) => g.id === otherGroupId),
    "THE FIX: immediately after promotion, the SAME OLD cookie now sees every group -- proves the list query re-checks the database, not the stale JWT claim"
  );
  r = await call(groupShow, { method: "GET", query: { id: otherGroupId }, cookie: staleCookie });
  assert(
    r.status === 200 && r.body.role === "admin",
    "THE FIX: the same old cookie can now access someone else's group directly with role=admin, with zero re-login"
  );

  // Demote them back down with the same old cookie still in hand, confirm access is revoked just as immediately.
  await adminPath(["users", String(staleUserId)], { method: "PATCH", cookie: dilanCookie, body: { is_admin: false } });
  r = await call(groupShow, { method: "GET", query: { id: otherGroupId }, cookie: staleCookie });
  assert(r.status === 404, "and demotion revokes that access just as immediately, same old cookie throughout");

  console.log(failures === 0 ? "\nALL PASSED" : `\n${failures} FAILURE(S)`);
  process.exit(failures === 0 ? 0 : 1);
};

run().catch((e) => {
  console.error("Unhandled error:", e);
  process.exit(1);
});
