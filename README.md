# ScoreMine Clone — Badminton Group Tracker

A minimal clone of the "casual group tracking + analytics" part of the ScoreMine
badminton app: create a group of regulars, log games (singles or doubles, set by
set), and see group analytics — player win %, best doubles pair, and deuce-game
rate — automatically computed from the scores you enter.

## Stack
- **Backend**: Node.js + Express + SQLite (via `better-sqlite3`) — a single file DB,
  zero setup. Swap `db.js` for Postgres/MySQL later without touching the API shape,
  since it's all plain SQL.
- **Frontend**: React (Vite) + Tailwind CSS.

## Project structure
```
backend/    Express API + SQLite schema (server.js, db.js)
frontend/   React app (Vite + Tailwind)
```

## Run it

Open two terminals:

**Backend** (http://localhost:4000)
```bash
cd backend
npm install
npm start
```

**Frontend** (http://localhost:5173)
```bash
cd frontend
npm install
npm run dev
```

Then open http://localhost:5173. The frontend calls the API at
`http://localhost:4000/api` (see `frontend/src/api.js` — change `BASE` there if you
deploy the backend somewhere else).

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

Win/pair/deuce analytics are computed on read in `GET /api/groups/:id/analytics`
rather than stored, so they're always consistent with the raw game log.

## Natural next steps (not built here — this was scoped as the MVP)
- Tournament module: brackets/rounds, standings tables, schedules
- Live/umpire scoring mode with point-by-point entry and a shareable live score view
- Shot-level stats (smash count, error count) — would need a `game_shots` table
  and an in-match logging UI
- Auth (right now there's no login — any visitor can create/edit any group)
