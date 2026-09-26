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

const SCHEMA_SQL = `
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
`;

const DROP_ALL_SQL = `
  DROP TABLE IF EXISTS game_sets CASCADE;
  DROP TABLE IF EXISTS game_players CASCADE;
  DROP TABLE IF EXISTS games CASCADE;
  DROP TABLE IF EXISTS group_members CASCADE;
  DROP TABLE IF EXISTS groups CASCADE;
  DROP TABLE IF EXISTS players CASCADE;
  DROP TABLE IF EXISTS password_reset_tokens CASCADE;
  DROP TABLE IF EXISTS users CASCADE;
`;

// Ordered, one-way migrations. Each runs at most once (tracked in
// schema_migrations) the first time ensureSchema() is called after being
// added. Version 3 is a full data wipe -- same schema as version 2, just
// dropped and recreated empty -- used to reset the app to a clean slate
// for testing without needing direct database access.
const ADD_RANKING_METHOD_SQL = `
  ALTER TABLE groups
    ADD COLUMN IF NOT EXISTS ranking_method TEXT NOT NULL DEFAULT 'win_percentage'
    CHECK (ranking_method IN ('win_percentage', 'points'));
`;

// Widens the ranking_method CHECK to also allow 'elo'. Finds the constraint
// by inspecting pg_constraint rather than assuming its auto-generated name,
// since that naming is a Postgres convention, not a guarantee.
const ADD_ELO_RANKING_METHOD_SQL = `
  DO $$
  DECLARE
    existing_constraint text;
  BEGIN
    SELECT con.conname INTO existing_constraint
    FROM pg_constraint con
    JOIN pg_class rel ON rel.oid = con.conrelid
    WHERE rel.relname = 'groups' AND con.contype = 'c'
      AND pg_get_constraintdef(con.oid) LIKE '%ranking_method%';
    IF existing_constraint IS NOT NULL THEN
      EXECUTE format('ALTER TABLE groups DROP CONSTRAINT %I', existing_constraint);
    END IF;
  END $$;
  ALTER TABLE groups ADD CONSTRAINT groups_ranking_method_check
    CHECK (ranking_method IN ('win_percentage', 'points', 'elo'));
`;

// Tournaments: round-robin only for now (knockout is a planned follow-up).
// A tournament_entry is a single player (singles) or a fixed pair (doubles)
// for the whole tournament. A fixture is a scheduled pairing between two
// entries; once played, it links to a real row in `games` -- so a
// tournament match IS a normal game (counts toward standings, rankings,
// head-to-head, profile stats) that also happens to belong to a fixture.
const ADD_TOURNAMENTS_SQL = `
  CREATE TABLE tournaments (
    id SERIAL PRIMARY KEY,
    group_id INTEGER NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    format TEXT NOT NULL DEFAULT 'round_robin' CHECK (format IN ('round_robin')),
    match_type TEXT NOT NULL CHECK (match_type IN ('singles','doubles')),
    status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','in_progress','completed')),
    public_slug TEXT NOT NULL UNIQUE,
    created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT now()
  );

  CREATE TABLE tournament_entries (
    id SERIAL PRIMARY KEY,
    tournament_id INTEGER NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
    player1_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    player2_id INTEGER REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE tournament_fixtures (
    id SERIAL PRIMARY KEY,
    tournament_id INTEGER NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
    round_number INTEGER NOT NULL,
    entry1_id INTEGER NOT NULL REFERENCES tournament_entries(id) ON DELETE CASCADE,
    entry2_id INTEGER NOT NULL REFERENCES tournament_entries(id) ON DELETE CASCADE,
    game_id INTEGER REFERENCES games(id) ON DELETE SET NULL
  );
`;

const MIGRATIONS = [
  { version: 2, sql: DROP_ALL_SQL + SCHEMA_SQL },
  { version: 3, sql: DROP_ALL_SQL + SCHEMA_SQL },
  { version: 4, sql: ADD_RANKING_METHOD_SQL },
  { version: 5, sql: ADD_ELO_RANKING_METHOD_SQL },
  { version: 6, sql: ADD_TOURNAMENTS_SQL },
];

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

    for (const { version, sql } of MIGRATIONS) {
      if (applied.has(version)) continue;
      const client = await db.connect();
      try {
        await client.query("BEGIN");
        await client.query(sql);
        await client.query("INSERT INTO schema_migrations (version) VALUES ($1)", [version]);
        await client.query("COMMIT");
      } catch (e) {
        await client.query("ROLLBACK");
        throw e;
      } finally {
        client.release();
      }
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
