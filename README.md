# NoExcuses — Badminton Group Tracker

A ScoreMine-style badminton tracker: sign up, create a group of regulars, log
games (singles or doubles, set by set), and see group analytics — player
win %, best doubles pair, and deuce-game rate — automatically computed from
the scores you enter.

## Stack (deployed on Vercel)
- **Frontend**: React (Vite) + Tailwind CSS + React Router, in `frontend/src/`.
- **Backend**: Vercel serverless functions, in `frontend/api/` — same-origin
  as the frontend, no CORS to configure.
- **Database**: Postgres (Neon, via Vercel's Storage integration).
- **Auth**: email + password (bcrypt), JWT session in an httpOnly cookie.
- **Email**: Resend, for password-reset links.

## Accounts & permissions
- Anyone can sign up with an email + password.
- **The first person to ever sign up becomes the admin automatically** —
  there's no separate "make me admin" step. Admins can see and manage every
  group, not just their own.
- Whoever creates a group is its **owner**. Owners can add or remove members
  by name + email, and can delete the group.
- Adding someone by email who hasn't signed up yet creates a placeholder
  account for them. When they sign up with that same email, they're
  automatically linked to every group they were invited to.
- Only a group's members (which includes its owner) can log games in that
  group. Everyone else gets a 404 on that group — its existence isn't leaked
  to people who don't have access.

## One-time setup on Vercel
This repo is connected to Vercel and auto-deploys on push. Three env vars
need to be set under **Project Settings → Environment Variables**, then
redeploy (push any commit, or hit Redeploy in the dashboard):

| Variable | Where it comes from |
|---|---|
| `DATABASE_URL` | Auto-injected once you add a Postgres integration under the **Storage** tab (Neon, free tier) |
| `JWT_SECRET` | Any long random string — signs session cookies |
| `RESEND_API_KEY` | From your Resend account (Settings → API Keys) |

Optional:
- `RESEND_FROM` — defaults to Resend's sandbox sender `onboarding@resend.dev`,
  which **can only deliver to your own Resend account email** until you
  verify a custom domain in Resend. Verify a domain, then set this to
  something like `NoExcuses <noreply@yourdomain.com>` so password resets
  reach real users.
- `APP_URL` — base URL used to build password-reset links. Defaults to
  whatever host the request came in on, which is usually correct as-is.

Tables (including `users`, `password_reset_tokens`, `groups`, etc.) are
created automatically on first request — no separate migration step.

## Local development
```bash
cd frontend
npm install
npx vercel link       # first time only, links to the existing Vercel project
npx vercel env pull .env.local
npx vercel dev         # serves the Vite app AND the /api functions together
```

## Testing
`frontend/test-harness.mjs` is a standalone integration test that exercises
every endpoint's real logic (signup, admin bootstrap, login, group
ownership/membership authorization, invite-and-claim, password reset) against
a real Postgres instance — no mocking.

```bash
createdb scoremine_test   # any local/reachable Postgres will do
cd frontend
node test-harness.mjs
```

## Project structure
```
frontend/
  src/
    context/AuthContext.jsx   Current-user state + login/signup/logout
    pages/                    Groups, GroupDetail, Login, Signup,
                               ForgotPassword, ResetPassword
  api/
    _lib/
      db.js        Postgres pool + versioned schema migrations
      auth.js       Password hashing, JWT sessions, cookies
      authz.js      Group role checks (admin / owner / member)
      email.js      Password-reset email via the Resend HTTP API
    auth/           signup, login, logout, me, forgot-password, reset-password
    groups/...      groups, members, games, analytics — all auth-gated
  test-harness.mjs   Full integration test (see Testing, above)
  vercel.json         SPA rewrite so client-side routes work on direct load
backend/            Legacy — the original pre-auth Express + SQLite server.
                    Not deployed. Kept only for reference.
```

## What's implemented
- Sign up, log in, log out, forgot/reset password (real email delivery via Resend)
- Admin role (first signup) with visibility into every group
- Groups with an owner; owner adds/removes members by name + email
- Log a game: singles or doubles, pick players per side, enter set-by-set scores
- Game history with a "Deuce" badge on any game where a set reached 20–20+
- Standings: per-player and per-pair win/loss + win %, deuce-game rate for the group

## Data model
`users` (email, password_hash, is_admin) — `groups` (owner_id) —
`group_members` — `games` (logged_by) — `game_players` (side 1 or 2) —
`game_sets` (one row per set) — `password_reset_tokens`.

Win/pair/deuce analytics are computed on read rather than stored, so they're
always consistent with the raw game log.

## Natural next steps (not built here — this was scoped as the MVP)
- Tournament module: brackets/rounds, standings tables, schedules
- Live/umpire scoring mode with point-by-point entry
- Shot-level stats (smash count, error count)
- Email verification on signup (currently any email can be claimed by
  whoever signs up with it first — fine for a trusted friend group, not for
  a fully public launch)
