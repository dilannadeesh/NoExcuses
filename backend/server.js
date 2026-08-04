import express from "express";
import cors from "cors";
import db from "./db.js";

const app = express();
app.use(cors());
app.use(express.json());

const isDeuceSet = (s1, s2) => s1 >= 20 && s2 >= 20;

// ---------- Players ----------

app.get("/api/players", (req, res) => {
  const players = db.prepare("SELECT * FROM players ORDER BY name").all();
  res.json(players);
});

app.post("/api/players", (req, res) => {
  const { name } = req.body;
  if (!name || !name.trim()) return res.status(400).json({ error: "Name is required" });
  try {
    const info = db.prepare("INSERT INTO players (name) VALUES (?)").run(name.trim());
    const player = db.prepare("SELECT * FROM players WHERE id = ?").get(info.lastInsertRowid);
    res.status(201).json(player);
  } catch (e) {
    if (String(e).includes("UNIQUE")) {
      const existing = db.prepare("SELECT * FROM players WHERE name = ?").get(name.trim());
      return res.status(200).json(existing);
    }
    res.status(500).json({ error: "Could not create player" });
  }
});

// ---------- Groups ----------

app.get("/api/groups", (req, res) => {
  const groups = db
    .prepare(
      `SELECT g.*, 
        (SELECT COUNT(*) FROM group_members gm WHERE gm.group_id = g.id) AS member_count,
        (SELECT COUNT(*) FROM games ga WHERE ga.group_id = g.id) AS game_count
       FROM groups g ORDER BY g.created_at DESC`
    )
    .all();
  res.json(groups);
});

app.post("/api/groups", (req, res) => {
  const { name } = req.body;
  if (!name || !name.trim()) return res.status(400).json({ error: "Name is required" });
  const info = db.prepare("INSERT INTO groups (name) VALUES (?)").run(name.trim());
  const group = db.prepare("SELECT * FROM groups WHERE id = ?").get(info.lastInsertRowid);
  res.status(201).json(group);
});

app.get("/api/groups/:id", (req, res) => {
  const group = db.prepare("SELECT * FROM groups WHERE id = ?").get(req.params.id);
  if (!group) return res.status(404).json({ error: "Group not found" });
  res.json(group);
});

app.delete("/api/groups/:id", (req, res) => {
  db.prepare("DELETE FROM groups WHERE id = ?").run(req.params.id);
  res.status(204).end();
});

// ---------- Group members ----------

app.get("/api/groups/:id/members", (req, res) => {
  const members = db
    .prepare(
      `SELECT p.* FROM players p
       JOIN group_members gm ON gm.player_id = p.id
       WHERE gm.group_id = ? ORDER BY p.name`
    )
    .all(req.params.id);
  res.json(members);
});

app.post("/api/groups/:id/members", (req, res) => {
  const groupId = req.params.id;
  const { name, player_id } = req.body;
  let playerId = player_id;

  if (!playerId) {
    if (!name || !name.trim()) return res.status(400).json({ error: "Name or player_id is required" });
    const existing = db.prepare("SELECT * FROM players WHERE name = ?").get(name.trim());
    if (existing) {
      playerId = existing.id;
    } else {
      const info = db.prepare("INSERT INTO players (name) VALUES (?)").run(name.trim());
      playerId = info.lastInsertRowid;
    }
  }

  db.prepare("INSERT OR IGNORE INTO group_members (group_id, player_id) VALUES (?, ?)").run(groupId, playerId);
  const player = db.prepare("SELECT * FROM players WHERE id = ?").get(playerId);
  res.status(201).json(player);
});

app.delete("/api/groups/:id/members/:playerId", (req, res) => {
  db.prepare("DELETE FROM group_members WHERE group_id = ? AND player_id = ?").run(
    req.params.id,
    req.params.playerId
  );
  res.status(204).end();
});

// ---------- Games ----------

app.get("/api/groups/:id/games", (req, res) => {
  const games = db
    .prepare("SELECT * FROM games WHERE group_id = ? ORDER BY played_at DESC, id DESC")
    .all(req.params.id);

  const withDetails = games.map((game) => {
    const players = db
      .prepare(
        `SELECT gp.side, p.id, p.name FROM game_players gp
         JOIN players p ON p.id = gp.player_id WHERE gp.game_id = ?`
      )
      .all(game.id);
    const sets = db
      .prepare("SELECT set_number, side1_score, side2_score FROM game_sets WHERE game_id = ? ORDER BY set_number")
      .all(game.id);
    return {
      ...game,
      side1: players.filter((p) => p.side === 1).map(({ id, name }) => ({ id, name })),
      side2: players.filter((p) => p.side === 2).map(({ id, name }) => ({ id, name })),
      sets,
      went_to_deuce: sets.some((s) => isDeuceSet(s.side1_score, s.side2_score)),
    };
  });

  res.json(withDetails);
});

app.post("/api/groups/:id/games", (req, res) => {
  const groupId = req.params.id;
  const { match_type, played_at, side1, side2, sets } = req.body;

  if (!["singles", "doubles"].includes(match_type)) {
    return res.status(400).json({ error: "match_type must be 'singles' or 'doubles'" });
  }
  const expectedCount = match_type === "singles" ? 1 : 2;
  if (!Array.isArray(side1) || !Array.isArray(side2) || side1.length !== expectedCount || side2.length !== expectedCount) {
    return res.status(400).json({ error: `Each side needs exactly ${expectedCount} player(s)` });
  }
  if (!Array.isArray(sets) || sets.length === 0) {
    return res.status(400).json({ error: "At least one set is required" });
  }

  let side1Sets = 0;
  let side2Sets = 0;
  for (const s of sets) {
    if (s.side1_score > s.side2_score) side1Sets++;
    else if (s.side2_score > s.side1_score) side2Sets++;
  }
  const winnerSide = side1Sets > side2Sets ? 1 : 2;

  const insertGame = db.transaction(() => {
    const info = db
      .prepare(
        "INSERT INTO games (group_id, match_type, played_at, winner_side) VALUES (?, ?, ?, ?)"
      )
      .run(groupId, match_type, played_at || new Date().toISOString().slice(0, 10), winnerSide);
    const gameId = info.lastInsertRowid;

    const insertPlayer = db.prepare("INSERT INTO game_players (game_id, player_id, side) VALUES (?, ?, ?)");
    side1.forEach((pid) => insertPlayer.run(gameId, pid, 1));
    side2.forEach((pid) => insertPlayer.run(gameId, pid, 2));

    const insertSet = db.prepare(
      "INSERT INTO game_sets (game_id, set_number, side1_score, side2_score) VALUES (?, ?, ?, ?)"
    );
    sets.forEach((s, i) => insertSet.run(gameId, i + 1, s.side1_score, s.side2_score));

    return gameId;
  });

  const gameId = insertGame();
  res.status(201).json({ id: gameId });
});

app.delete("/api/games/:id", (req, res) => {
  db.prepare("DELETE FROM games WHERE id = ?").run(req.params.id);
  res.status(204).end();
});

// ---------- Analytics ----------

app.get("/api/groups/:id/analytics", (req, res) => {
  const groupId = req.params.id;
  const games = db.prepare("SELECT * FROM games WHERE group_id = ?").all(groupId);

  if (games.length === 0) {
    return res.json({ totalGames: 0, deucePercentage: 0, playerStats: [], pairStats: [] });
  }

  const gameIds = games.map((g) => g.id);
  const placeholders = gameIds.map(() => "?").join(",");

  const sets = db
    .prepare(`SELECT * FROM game_sets WHERE game_id IN (${placeholders})`)
    .all(...gameIds);
  const gamePlayers = db
    .prepare(
      `SELECT gp.*, p.name FROM game_players gp JOIN players p ON p.id = gp.player_id
       WHERE gp.game_id IN (${placeholders})`
    )
    .all(...gameIds);

  const deuceGameIds = new Set(
    sets.filter((s) => isDeuceSet(s.side1_score, s.side2_score)).map((s) => s.game_id)
  );
  const deucePercentage = Math.round((deuceGameIds.size / games.length) * 1000) / 10;

  // Per-player win/loss
  const playerMap = new Map(); // id -> {id, name, wins, losses}
  const gamesById = new Map(games.map((g) => [g.id, g]));

  for (const gp of gamePlayers) {
    const game = gamesById.get(gp.game_id);
    if (!playerMap.has(gp.player_id)) {
      playerMap.set(gp.player_id, { id: gp.player_id, name: gp.name, wins: 0, losses: 0 });
    }
    const entry = playerMap.get(gp.player_id);
    if (game.winner_side === gp.side) entry.wins++;
    else entry.losses++;
  }

  const playerStats = [...playerMap.values()]
    .map((p) => ({
      ...p,
      games: p.wins + p.losses,
      winPercentage: Math.round((p.wins / (p.wins + p.losses)) * 1000) / 10,
    }))
    .sort((a, b) => b.winPercentage - a.winPercentage || b.games - a.games);

  // Doubles pair stats: group side-players by (game_id, side) for doubles games only
  const doublesGameIds = new Set(games.filter((g) => g.match_type === "doubles").map((g) => g.id));
  const sideGroups = new Map(); // key `${game_id}-${side}` -> [player_ids]
  for (const gp of gamePlayers) {
    if (!doublesGameIds.has(gp.game_id)) continue;
    const key = `${gp.game_id}-${gp.side}`;
    if (!sideGroups.has(key)) sideGroups.set(key, { game_id: gp.game_id, side: gp.side, players: [] });
    sideGroups.get(key).players.push({ id: gp.player_id, name: gp.name });
  }

  const pairMap = new Map(); // sortedIds joined -> {names, wins, losses}
  for (const { game_id, side, players } of sideGroups.values()) {
    if (players.length !== 2) continue;
    const sortedIds = [...players].sort((a, b) => a.id - b.id);
    const key = sortedIds.map((p) => p.id).join("-");
    if (!pairMap.has(key)) {
      pairMap.set(key, { key, names: sortedIds.map((p) => p.name), wins: 0, losses: 0 });
    }
    const entry = pairMap.get(key);
    const game = gamesById.get(game_id);
    if (game.winner_side === side) entry.wins++;
    else entry.losses++;
  }

  const pairStats = [...pairMap.values()]
    .map((p) => ({
      ...p,
      games: p.wins + p.losses,
      winPercentage: Math.round((p.wins / (p.wins + p.losses)) * 1000) / 10,
    }))
    .sort((a, b) => b.winPercentage - a.winPercentage || b.games - a.games);

  res.json({
    totalGames: games.length,
    deucePercentage,
    deuceGames: deuceGameIds.size,
    playerStats,
    pairStats,
    bestPair: pairStats[0] || null,
  });
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`ScoreMine clone API listening on http://localhost:${PORT}`));
