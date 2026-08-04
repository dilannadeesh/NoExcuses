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

// Migration-tracked schema. Version 2 replaces the old name-only "players"
// concept with real user accounts (email + password) and group ownership,
// so it drops and recreates the game/group tables — any data from the
// earlier no-auth version of this app is not preserved.
export async function ensureSchema() {
  if (schemaReady) return schemaReady;
  const db = getPool();
  schemaReady = (async () => {
    await db.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version INT PRIMARY KEY,
        applied_at TIMESTAMPTZ DEFAULT now()
      );
    `);
    const { rows } = await db.query("SELECT version FROM schema_migrations");
    const applied = new Set(rows.map((r) => r.version));
    if (applied.has(2)) return;

    const client = await db.connect();
    try {
      await client.query("BEGIN");
      await client.query(`
        DROP TABLE IF EXISTS game_sets CASCADE;
        DROP TABLE IF EXISTS game_players CASCADE;
        DROP TABLE IF EXISTS games CASCADE;
        DROP TABLE IF EXISTS group_members CASCADE;
        DROP TABLE IF EXISTS groups CASCADE;
        DROP TABLE IF EXISTS players CASCADE;
        DROP TABLE IF EXISTS password_reset_tokens CASCADE;
        DROP TABLE IF EXISTS users CASCADE;

        CREATE TABLE users (
          id SERIAL PRIMARY KEY,
          email TEXT NOT NULL UNIQUE,
          name TEXT NOT NULL,
          password_hash TEXT,
          is_admin BOOLEAN NOT NULL DEFAULT false,
          created_at TIMESTAMPTZ DEFAULT now()
        );

        CREATE TABLE password_reset_tokens (
          token TEXT PRIMARY KEY,
          user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          expires_at TIMESTAMPTZ NOT NULL,
          used_at TIMESTAMPTZ
        );

        CREATE TABLE groups (
          id SERIAL PRIMARY KEY,
          name TEXT NOT NULL,
          owner_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          created_at TIMESTAMPTZ DEFAULT now()
        );

        CREATE TABLE group_members (
          group_id INTEGER NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
          user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          PRIMARY KEY (group_id, user_id)
        );

        CREATE TABLE games (
          id SERIAL PRIMARY KEY,
          group_id INTEGER NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
          match_type TEXT NOT NULL CHECK (match_type IN ('singles','doubles')),
          played_at DATE NOT NULL,
          winner_side INTEGER NOT NULL CHECK (winner_side IN (1,2)),
          logged_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
          created_at TIMESTAMPTZ DEFAULT now()
        );

        CREATE TABLE game_players (
          game_id INTEGER NOT NULL REFERENCES games(id) ON DELETE CASCADE,
          user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          side INTEGER NOT NULL CHECK (side IN (1,2)),
          PRIMARY KEY (game_id, user_id)
        );

        CREATE TABLE game_sets (
          id SERIAL PRIMARY KEY,
          game_id INTEGER NOT NULL REFERENCES games(id) ON DELETE CASCADE,
          set_number INTEGER NOT NULL,
          side1_score INTEGER NOT NULL,
          side2_score INTEGER NOT NULL
        );
      `);
      await client.query("INSERT INTO schema_migrations (version) VALUES (2)");
      await client.query("COMMIT");
    } catch (e) {
      await client.query("ROLLBACK");
      throw e;
    } finally {
      client.release();
    }
  })();
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
