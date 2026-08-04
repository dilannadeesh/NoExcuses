# ScoreMine Clone — Badminton Group Tracker

A minimal clone of the "casual group tracking + analytics" part of the ScoreMine
badminton app: create a group of regulars, log games (singles or doubles, set by
set), and see group analytics — player win %, best doubles pair, and deuce-game
rate — automatically computed from the scores you enter.

## Stack (current — deployed on Vercel)
- **Frontend**: React (Vite) + Tailwind CSS, in `frontend/`.
- **Backend**: Vercel serverless functions, in `frontend/api/` — same-origin as
  the frontend, no separate server to run or CORS to configure.
- **Database**: Postgres (built for Neon, Vercel's current Postgres marketplace
  integration — plain `pg`/node-postgres under the hood, so any Postgres works).

## One-time setup on Vercel
This repo is already connected to Vercel and auto-deploys on push. To make the
API actually work in production, it needs a database:

1. Open the `no-excuses` project on vercel.com → **Storage** tab.
2. Add a Postgres integration (Neon) — a couple of clicks, no billing required
   on the free tier. This automatically injects a `DATABASE_URL` env var into
   the project — you don't need to copy/paste a connection string.
3. Trigger a new deployment so the functions pick up the new env var (either
   push any commit, or hit **Redeploy** on the latest deployment in the Vercel
   dashboard).

Tables are created automatically on first request (`CREATE TABLE IF NOT EXISTS`
in `frontend/api/_lib/db.js`) — no separate migration step needed.

## Local development
```bash
cd frontend
npm install
npx vercel link      # first time only, links to the existing Vercel project
npx vercel env pull .env.local
npx vercel dev        # serves the Vite app AND the /api functions together
```

## Project structure
```
frontend/
  src/            React app
  api/            Vercel serverless functions (the backend)
    _lib/db.js    Postgres pool, schema init, shared helpers
    groups/...    groups, members, games, analytics routes
  test-harness.mjs  Standalone integration test — runs every endpoint's real
                    logic against a Postgres instance (set DATABASE_URL to any
                    reachable Postgres, e.g. a local one, and `node test-harness.mjs`)
backend/          Legacy — the original standalone Express + SQLite server this
                  was migrated from. Not deployed. Kept only for reference; safe
                  to delete once you're happy with the Vercel version.
```

## What's implemented
- Create groups, add/remove players
- Log a game: singles or doubles, pick players per side, enter set-by-set scores
- Game history with a "Deuce" badge on any game where a set reached 20–20+
- Standings tab:
  - Per-player win/loss record and win %
  - Per-pair (doubles) win/loss record and win % — the "best pair" analytic
  - Deuce-game rate for the group

## Data model
`players` — `groups` — `group_members` (join table) — `games` — `game_players`
(join table with a `side` of 1 or 2) — `game_sets` (one row per set, so any
best-of-N is supported, not just best-of-3).

Win/pair/deuce analytics are computed on read (`GET /api/groups/:id/analytics`)
rather than stored, so they're always consistent with the raw game log.

## Natural next steps (not built here — this was scoped as the MVP)
- Tournament module: brackets/rounds, standings tables, schedules
- Live/umpire scoring mode with point-by-point entry and a shareable live score view
- Shot-level stats (smash count, error count) — would need a `game_shots` table
  and an in-match logging UI
- Auth (right now there's no login — any visitor can create/edit any group)
