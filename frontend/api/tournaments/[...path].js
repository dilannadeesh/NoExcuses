import { getPool, ensureSchema, sendJson, readJsonBody } from "../_lib/db.js";
import { getSession } from "../_lib/auth.js";
import { getGroupRole, isOwner, canLogGames } from "../_lib/authz.js";
import { generateRoundRobinRounds } from "../_lib/tournamentLogic.js";
import { validateGameShape, computeWinnerSide } from "../_lib/gameLogic.js";

const isNumeric = (s) => /^\d+$/.test(s);

async function loadTournamentDetail(db, tournament) {
  const { rows: entries } = await db.query(
    `SELECT te.id, te.player1_id, te.player2_id, u1.name AS player1_name, u2.name AS player2_name
     FROM tournament_entries te
     JOIN users u1 ON u1.id = te.player1_id
     LEFT JOIN users u2 ON u2.id = te.player2_id
     WHERE te.tournament_id = $1`,
    [tournament.id]
  );
  const entriesById = new Map(
    entries.map((e) => [
      e.id,
      { id: e.id, name: e.player2_name ? `${e.player1_name} & ${e.player2_name}` : e.player1_name },
    ])
  );

  const { rows: fixtures } = await db.query(
    `SELECT f.id, f.round_number, f.entry1_id, f.entry2_id, f.game_id,
        g.winner_side,
        (SELECT json_agg(json_build_object('side1_score', gs.side1_score, 'side2_score', gs.side2_score) ORDER BY gs.set_number)
         FROM game_sets gs WHERE gs.game_id = g.id) AS sets
     FROM tournament_fixtures f
     LEFT JOIN games g ON g.id = f.game_id
     WHERE f.tournament_id = $1
     ORDER BY f.round_number, f.id`,
    [tournament.id]
  );

  const standingsMap = new Map();
  for (const e of entries) standingsMap.set(e.id, { id: e.id, name: entriesById.get(e.id).name, wins: 0, losses: 0 });

  const fixturesOut = fixtures.map((f) => {
    const played = f.game_id != null;
    if (played) {
      const winnerEntryId = f.winner_side === 1 ? f.entry1_id : f.entry2_id;
      const loserEntryId = f.winner_side === 1 ? f.entry2_id : f.entry1_id;
      standingsMap.get(winnerEntryId).wins++;
      standingsMap.get(loserEntryId).losses++;
    }
    return {
      id: f.id,
      round: f.round_number,
      entry1: entriesById.get(f.entry1_id),
      entry2: entriesById.get(f.entry2_id),
      played,
      winnerEntryId: played ? (f.winner_side === 1 ? f.entry1_id : f.entry2_id) : null,
      sets: f.sets || [],
    };
  });

  const standings = [...standingsMap.values()]
    .map((s) => ({ ...s, games: s.wins + s.losses }))
    .sort((a, b) => b.wins - a.wins || a.losses - b.losses);

  return {
    id: tournament.id,
    name: tournament.name,
    format: tournament.format,
    match_type: tournament.match_type,
    status: tournament.status,
    public_slug: tournament.public_slug,
    created_at: tournament.created_at,
    entries: [...entriesById.values()],
    fixtures: fixturesOut,
    standings,
  };
}

async function handleDetail(req, res, db, idOrSlug) {
  const query = isNumeric(idOrSlug)
    ? { sql: "SELECT * FROM tournaments WHERE id = $1", param: idOrSlug }
    : { sql: "SELECT * FROM tournaments WHERE public_slug = $1", param: idOrSlug };
  const { rows } = await db.query(query.sql, [query.param]);
  const tournament = rows[0];
  if (!tournament) return sendJson(res, 404, { error: "Tournament not found" });

  let role = null;
  if (isNumeric(idOrSlug)) {
    // Numeric id -> this is the authenticated, in-app view: require group access.
    const session = getSession(req);
    if (!session) return sendJson(res, 401, { error: "Not authenticated" });
    role = await getGroupRole(db, tournament.group_id, session);
    if (!role) return sendJson(res, 404, { error: "Tournament not found" });
  }
  // Non-numeric (a public_slug) is the public shareable link -- no auth at all,
  // by design: that's the point of a link you can hand to anyone. role stays
  // null there, which the frontend uses to know it's the public view.

  return sendJson(res, 200, { ...(await loadTournamentDetail(db, tournament)), role });
}

async function handleGenerateFixtures(req, res, db, id) {
  const session = getSession(req);
  if (!session) return sendJson(res, 401, { error: "Not authenticated" });

  const { rows } = await db.query("SELECT * FROM tournaments WHERE id = $1", [id]);
  const tournament = rows[0];
  if (!tournament) return sendJson(res, 404, { error: "Tournament not found" });
  const role = await getGroupRole(db, tournament.group_id, session);
  if (!role) return sendJson(res, 404, { error: "Tournament not found" });
  if (!isOwner(role)) return sendJson(res, 403, { error: "Only the group owner can generate fixtures" });
  if (tournament.status !== "draft") {
    return sendJson(res, 409, { error: "Fixtures have already been generated for this tournament" });
  }

  const { rows: entries } = await db.query("SELECT id FROM tournament_entries WHERE tournament_id = $1", [id]);
  const rounds = generateRoundRobinRounds(entries.map((e) => e.id));

  const client = await db.connect();
  try {
    await client.query("BEGIN");
    for (let roundNumber = 0; roundNumber < rounds.length; roundNumber++) {
      for (const [entry1Id, entry2Id] of rounds[roundNumber]) {
        await client.query(
          "INSERT INTO tournament_fixtures (tournament_id, round_number, entry1_id, entry2_id) VALUES ($1, $2, $3, $4)",
          [id, roundNumber + 1, entry1Id, entry2Id]
        );
      }
    }
    await client.query("UPDATE tournaments SET status = 'in_progress' WHERE id = $1", [id]);
    await client.query("COMMIT");
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }

  const { rows: updated } = await db.query("SELECT * FROM tournaments WHERE id = $1", [id]);
  return sendJson(res, 200, await loadTournamentDetail(db, updated[0]));
}

async function handleRecordResult(req, res, db, id, fixtureId) {
  const session = getSession(req);
  if (!session) return sendJson(res, 401, { error: "Not authenticated" });

  const { rows: tRows } = await db.query("SELECT * FROM tournaments WHERE id = $1", [id]);
  const tournament = tRows[0];
  if (!tournament) return sendJson(res, 404, { error: "Tournament not found" });
  const role = await getGroupRole(db, tournament.group_id, session);
  if (!role) return sendJson(res, 404, { error: "Tournament not found" });
  if (!canLogGames(role)) return sendJson(res, 403, { error: "Only group members can record results" });

  const { rows: fRows } = await db.query(
    "SELECT * FROM tournament_fixtures WHERE id = $1 AND tournament_id = $2",
    [fixtureId, id]
  );
  const fixture = fRows[0];
  if (!fixture) return sendJson(res, 404, { error: "Fixture not found" });

  const { rows: entryRows } = await db.query(
    "SELECT * FROM tournament_entries WHERE id = ANY($1::int[])",
    [[fixture.entry1_id, fixture.entry2_id]]
  );
  const entry1 = entryRows.find((e) => e.id === fixture.entry1_id);
  const entry2 = entryRows.find((e) => e.id === fixture.entry2_id);
  const side1 = [entry1.player1_id, entry1.player2_id].filter(Boolean);
  const side2 = [entry2.player1_id, entry2.player2_id].filter(Boolean);

  const { played_at, sets } = await readJsonBody(req);
  const validationError = validateGameShape(tournament.match_type, side1, side2, sets);
  if (validationError) return sendJson(res, 400, { error: validationError });
  const winnerSide = computeWinnerSide(sets);

  const client = await db.connect();
  try {
    await client.query("BEGIN");

    // Re-recording a result: replace the old game entirely rather than
    // leaving a stale one behind or requiring a separate "edit fixture" flow.
    if (fixture.game_id) {
      await client.query("DELETE FROM games WHERE id = $1", [fixture.game_id]);
    }

    const { rows: gRows } = await client.query(
      "INSERT INTO games (group_id, match_type, played_at, winner_side, logged_by) VALUES ($1, $2, $3, $4, $5) RETURNING id",
      [tournament.group_id, tournament.match_type, played_at || new Date().toISOString().slice(0, 10), winnerSide, session.sub]
    );
    const gameId = gRows[0].id;

    for (const pid of side1) {
      await client.query("INSERT INTO game_players (game_id, user_id, side) VALUES ($1, $2, 1)", [gameId, pid]);
    }
    for (const pid of side2) {
      await client.query("INSERT INTO game_players (game_id, user_id, side) VALUES ($1, $2, 2)", [gameId, pid]);
    }
    for (let i = 0; i < sets.length; i++) {
      await client.query(
        "INSERT INTO game_sets (game_id, set_number, side1_score, side2_score) VALUES ($1, $2, $3, $4)",
        [gameId, i + 1, sets[i].side1_score, sets[i].side2_score]
      );
    }
    await client.query("UPDATE tournament_fixtures SET game_id = $1 WHERE id = $2", [gameId, fixture.id]);

    // Auto-complete the tournament once every fixture has a recorded result.
    const { rows: remaining } = await client.query(
      "SELECT COUNT(*)::int AS n FROM tournament_fixtures WHERE tournament_id = $1 AND game_id IS NULL",
      [id]
    );
    if (remaining[0].n === 0) {
      await client.query("UPDATE tournaments SET status = 'completed' WHERE id = $1", [id]);
    }

    await client.query("COMMIT");
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }

  const { rows: updated } = await db.query("SELECT * FROM tournaments WHERE id = $1", [id]);
  return sendJson(res, 200, await loadTournamentDetail(db, updated[0]));
}

export default async function handler(req, res) {
  await ensureSchema();
  const db = getPool();
  const segments = req.query.path || [];
  const [idOrSlug, sub, fixtureId] = segments;

  if (!idOrSlug) return sendJson(res, 404, { error: "Not found" });

  if (sub === "fixtures" && fixtureId) {
    if (req.method !== "POST") {
      res.setHeader("Allow", "POST");
      return sendJson(res, 405, { error: "Method not allowed" });
    }
    return handleRecordResult(req, res, db, idOrSlug, fixtureId);
  }

  if (!sub) {
    if (req.method === "GET") return handleDetail(req, res, db, idOrSlug);
    if (req.method === "POST") return handleGenerateFixtures(req, res, db, idOrSlug);
    res.setHeader("Allow", "GET, POST");
    return sendJson(res, 405, { error: "Method not allowed" });
  }

  return sendJson(res, 404, { error: "Not found" });
}
