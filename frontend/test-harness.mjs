// One-off local integration test: exercises the real serverless handlers
// against a real Postgres instance, simulating Vercel's req/res shape.
process.env.DATABASE_URL = "postgresql://postgres:testpass@localhost:5432/scoremine_test";

import groupsIndex from "./api/groups/index.js";
import groupShow from "./api/groups/[id]/index.js";
import membersIndex from "./api/groups/[id]/members/index.js";
import memberDelete from "./api/groups/[id]/members/[playerId].js";
import gamesIndex from "./api/groups/[id]/games/index.js";
import gameDelete from "./api/games/[id].js";
import analytics from "./api/groups/[id]/analytics.js";

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

async function call(handler, { method = "GET", query = {}, body }) {
  const req = { method, query, body };
  const res = mockRes();
  await handler(req, res);
  let parsed = res.body;
  try {
    parsed = res.body ? JSON.parse(res.body) : undefined;
  } catch {
    /* not json (e.g. 204) */
  }
  return { status: res.statusCode, body: parsed };
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
  // Create a group
  let r = await call(groupsIndex, { method: "POST", body: { name: "Tuesday Crew" } });
  assert(r.status === 201 && r.body.name === "Tuesday Crew", "create group");
  const groupId = r.body.id;

  // List groups
  r = await call(groupsIndex, { method: "GET" });
  assert(r.status === 200 && Array.isArray(r.body) && r.body.length === 1, "list groups");

  // Get single group
  r = await call(groupShow, { method: "GET", query: { id: groupId } });
  assert(r.status === 200 && r.body.id === groupId, "get single group");

  // Add 4 members
  const names = ["Alex", "Priya", "Sam", "Wei"];
  const playerIds = {};
  for (const name of names) {
    r = await call(membersIndex, { method: "POST", query: { id: groupId }, body: { name } });
    assert(r.status === 201 && r.body.name === name, `add member ${name}`);
    playerIds[name] = r.body.id;
  }

  // Re-adding same name should return existing player, not duplicate
  r = await call(membersIndex, { method: "POST", query: { id: groupId }, body: { name: "Alex" } });
  assert(r.status === 201 && r.body.id === playerIds["Alex"], "re-adding existing name returns same player");

  // List members
  r = await call(membersIndex, { method: "GET", query: { id: groupId } });
  assert(r.status === 200 && r.body.length === 4, "list members (still 4, no dupes)");

  // Log a doubles game that goes to deuce
  r = await call(gamesIndex, {
    method: "POST",
    query: { id: groupId },
    body: {
      match_type: "doubles",
      played_at: "2026-08-01",
      side1: [playerIds["Alex"], playerIds["Priya"]],
      side2: [playerIds["Sam"], playerIds["Wei"]],
      sets: [
        { side1_score: 21, side2_score: 18 },
        { side1_score: 19, side2_score: 21 },
        { side1_score: 22, side2_score: 20 },
      ],
    },
  });
  assert(r.status === 201 && r.body.id, "log doubles game (3 sets, deuce in set 3)");
  const game1Id = r.body.id;

  // Log a second doubles game, same pairing, straight sets win for Alex/Priya
  r = await call(gamesIndex, {
    method: "POST",
    query: { id: groupId },
    body: {
      match_type: "doubles",
      played_at: "2026-08-02",
      side1: [playerIds["Alex"], playerIds["Priya"]],
      side2: [playerIds["Sam"], playerIds["Wei"]],
      sets: [
        { side1_score: 21, side2_score: 15 },
        { side1_score: 21, side2_score: 17 },
      ],
    },
  });
  assert(r.status === 201, "log second doubles game (straight sets, no deuce)");

  // List games, check details + deuce flag
  r = await call(gamesIndex, { method: "GET", query: { id: groupId } });
  assert(r.status === 200 && r.body.length === 2, "list games returns 2");
  const g1 = r.body.find((g) => g.id === game1Id);
  assert(g1.went_to_deuce === true, "game 1 correctly flagged as deuce");
  assert(g1.side1.length === 2 && g1.side2.length === 2, "game 1 has 2 players per side");
  assert(g1.winner_side === 1, "game 1 winner_side computed correctly (2 sets to 1)");
  const g2 = r.body.find((g) => g.id !== game1Id);
  assert(g2.went_to_deuce === false, "game 2 correctly NOT flagged as deuce");

  // Analytics
  r = await call(analytics, { method: "GET", query: { id: groupId } });
  assert(r.status === 200, "analytics endpoint responds 200");
  assert(r.body.totalGames === 2, "analytics totalGames === 2");
  assert(r.body.deucePercentage === 50, `analytics deucePercentage === 50 (got ${r.body.deucePercentage})`);
  const alexStat = r.body.playerStats.find((p) => p.id === playerIds["Alex"]);
  assert(alexStat.wins === 2 && alexStat.losses === 0 && alexStat.winPercentage === 100, "Alex is 2-0, 100%");
  const samStat = r.body.playerStats.find((p) => p.id === playerIds["Sam"]);
  assert(samStat.wins === 0 && samStat.losses === 2, "Sam is 0-2");
  assert(r.body.bestPair && r.body.bestPair.winPercentage === 100, "best pair is 100% (Alex & Priya, only pair)");
  assert(
    r.body.bestPair.names.includes("Alex") && r.body.bestPair.names.includes("Priya"),
    "best pair names are Alex & Priya"
  );

  // Remove a member
  r = await call(memberDelete, { method: "DELETE", query: { id: groupId, playerId: playerIds["Wei"] } });
  assert(r.status === 204, "delete member returns 204");
  r = await call(membersIndex, { method: "GET", query: { id: groupId } });
  assert(r.body.length === 3, "member count is 3 after removal");

  // Delete a game
  r = await call(gameDelete, { method: "DELETE", query: { id: game1Id } });
  assert(r.status === 204, "delete game returns 204");
  r = await call(gamesIndex, { method: "GET", query: { id: groupId } });
  assert(r.body.length === 1, "game count is 1 after deletion");

  // Analytics reflect the deletion
  r = await call(analytics, { method: "GET", query: { id: groupId } });
  assert(r.body.totalGames === 1, "analytics totalGames updates to 1 after game deletion");
  assert(r.body.deucePercentage === 0, "deucePercentage updates to 0 (remaining game had no deuce)");

  console.log(failures === 0 ? "\nALL PASSED" : `\n${failures} FAILURE(S)`);
  process.exit(failures === 0 ? 0 : 1);
};

run().catch((e) => {
  console.error("Unhandled error:", e);
  process.exit(1);
});
