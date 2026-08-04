import pg from "pg";
const { Pool } = pg;

let pool;
let schemaReady;

export function getPool() {
  if (!pool) {
    const connectionString = process.env.DATABASE_URL || process.env.POSTGRES_URL;
    if (!connectionString) {
      throw new Error(
        "No DATABASE_URL / POSTGRES_URL env var found. Connect a Postgres integration in the Vercel dashboard (Storage tab)."
      );
    }
    const isLocal = /localhost|127\.0\.0\.1/.test(connectionString);
    pool = new Pool({
      connectionString,
      ssl: isLocal ? false : { rejectUnauthorized: false },
      max: 5,
    });
  }
  return pool;
}

// Idempotent — cheap enough to run per cold start, keeps this deploy migration-free.
export async function ensureSchema() {
  if (schemaReady) return schemaReady;
  const db = getPool();
  schemaReady = db.query(`
    CREATE TABLE IF NOT EXISTS players (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL UNIQUE
    );

    CREATE TABLE IF NOT EXISTS groups (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      created_at TIMESTAMPTZ DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS group_members (
      group_id INTEGER NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
      player_id INTEGER NOT NULL REFERENCES players(id) ON DELETE CASCADE,
      PRIMARY KEY (group_id, player_id)
    );

    CREATE TABLE IF NOT EXISTS games (
      id SERIAL PRIMARY KEY,
      group_id INTEGER NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
      match_type TEXT NOT NULL CHECK (match_type IN ('singles','doubles')),
      played_at DATE NOT NULL,
      winner_side INTEGER NOT NULL CHECK (winner_side IN (1,2)),
      created_at TIMESTAMPTZ DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS game_players (
      game_id INTEGER NOT NULL REFERENCES games(id) ON DELETE CASCADE,
      player_id INTEGER NOT NULL REFERENCES players(id) ON DELETE CASCADE,
      side INTEGER NOT NULL CHECK (side IN (1,2)),
      PRIMARY KEY (game_id, player_id)
    );

    CREATE TABLE IF NOT EXISTS game_sets (
      id SERIAL PRIMARY KEY,
      game_id INTEGER NOT NULL REFERENCES games(id) ON DELETE CASCADE,
      set_number INTEGER NOT NULL,
      side1_score INTEGER NOT NULL,
      side2_score INTEGER NOT NULL
    );
  `);
  await schemaReady;
  return schemaReady;
}

export const isDeuceSet = (s1, s2) => s1 >= 20 && s2 >= 20;

export async function readJsonBody(req) {
  // Vercel Node functions usually pre-parse JSON into req.body, but guard for raw-string/edge cases.
  if (req.body && typeof req.body === "object") return req.body;
  if (typeof req.body === "string" && req.body.length) return JSON.parse(req.body);
  return {};
}

export function sendJson(res, status, payload) {
  res.status(status).setHeader("Content-Type", "application/json").send(JSON.stringify(payload));
}
