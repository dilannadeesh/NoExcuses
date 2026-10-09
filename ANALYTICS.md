# Analytics (Google Analytics 4 — free)

The web app and the Android app (a webview of the same site) report to one GA4 property.
Nothing is sent until you set the Measurement ID.

## 1. Turn it on (≈5 minutes)
1. https://analytics.google.com → Admin → **Create property** → add a **Web** data stream for
   `https://www.noexcusesbadminton.com`. Copy the **Measurement ID** (`G-XXXXXXXXXX`).
2. Vercel → project → Settings → Environment Variables → add `VITE_GA_MEASUREMENT_ID` = that ID
   (Production) → **Redeploy**. The Android app picks it up automatically (no new APK).
3. Check it: open the site with `?ga_debug=1` and watch GA → Admin → **DebugView**.
4. GA → Admin → **Events** → mark these as **Key events**: `sign_up`, `group_created`,
   `member_added`, `game_logged`, `schedule_saved`.
5. (Optional) Admin → Data settings → Data filters → create an *Internal traffic* filter for
   `traffic_type = internal` — super-admin visits are tagged so your own testing doesn't skew numbers.

## 2. What is tracked
| Event | Meaning / params |
|---|---|
| `page_view` | every screen; `page_path` is a pattern (`/groups/:id/log`), never real ids/tokens |
| `form_start` | first touch of any form on a page (`page`) — start vs. submit = form drop-off |
| `sign_up` / `sign_up_failed` | account created / failed (`status`, `endpoint`) |
| `login` / `login_failed` | |
| `password_reset_requested`, `password_reset_done`, `*_failed` | |
| `group_created`, `member_added`, `game_logged`, `game_edited`, `tournament_created` | + `*_failed` variants |
| `schedule_step` | planner screens: `pick_players` → `pick_format` → `schedule` (`role`) |
| `schedule_generated` / `schedule_saved` / `schedule_cleared` | `mode`, `courts`, `players` |
| `schedule_shared` | `method`: whatsapp / telegram / copy / native |
| **`ui_error`** | an error message the user actually saw (`page`, scrubbed `message`) |
| **`api_error`** | failed request (`endpoint`, `method`, `status`, `kind` = network/server/client) |
| **`api_slow`** | successful request that took ≥ 4 s (cold start / slow DB) |
| **`js_error`** | uncaught JavaScript error / rejected promise (max 10 per page load) |

User properties: `platform` (`web` / `android_app`), `role`. `user_id` is the internal id only.
No names, emails, passwords, tokens or free text are ever sent (emails/long ids in error
text are scrubbed). Do-Not-Track browsers are skipped; ad signals are off.

## 3. Finding problems and drop-offs
- **Funnel (where people quit):** Explore → *Funnel exploration* → steps:
  `page_view` (`page_path = /signup`) → `form_start` → `sign_up`.
  Same idea: `/groups/:id/log` → `form_start` → `game_logged`; or
  `schedule_step (pick_players)` → `schedule_step (pick_format)` → `schedule_generated` → `schedule_shared`.
- **What went wrong:** Reports → Engagement → Events → click `ui_error` → add the `message`
  and `page` custom dimensions (below) to see the most common errors per screen. Same for
  `api_error` (`endpoint` + `status`) and `js_error`.
- **Slow app:** `api_slow` by `endpoint`.
- **Web vs app:** add the `platform` dimension to any report.

## 4. Register the custom dimensions (once, so params show in reports)
Admin → Custom definitions → Create custom dimension (scope **Event**) for each parameter name:
`page`, `message`, `endpoint`, `method`, `status`, `kind`, `step`, `role`, `mode`, `method`
(`method` is shared), `courts`, `players`; and scope **User**: `platform`, `role`.
Data appears in standard reports after ~24 h; DebugView and Realtime are instant.

## Code map
`frontend/src/lib/analytics.js` (all logic) · `frontend/src/api.js` (auto-reports API calls) ·
`components/States.jsx` + `pages/AuthLayout.jsx` (`ui_error`) · `App.jsx` (page views, identify) ·
`pages/SchedulePage.jsx` (planner steps, share) · tests: `npm run test:analytics`.
