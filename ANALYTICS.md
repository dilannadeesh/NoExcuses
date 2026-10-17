# Analytics (Google Analytics 4 — free)

The website and the iPhone and Android apps (Capacitor webviews of the same site) report to one GA4 property.
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

User properties: `platform` (`ios_app` / `android_app` / `web`), `role`. `user_id` is the internal id only.
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

## 5. Admin dashboard (Admin → Analytics tab)
Super admins get an **Analytics** tab with iOS app / Android app / website side by side
(7, 28 or 90 days). It has two independent halves:

**From the app's own database — works with no setup.** Every signed-in request carries an
`X-Client-Platform` header (`ios_app` / `android_app` / `web`, from Capacitor); the API stores
one row per person per platform per day (`platform_activity`) and the platform each person
signed up on (`users.signup_platform`). The tab shows active users today / 7 / 30 days, new
people, how many came back on 2+ days, phones with notifications on, and a daily chart.
Days are counted in `ANALYTICS_TIMEZONE` (default `Asia/Singapore`). Counting starts with
this release; older signups show as "unknown".

**From Google Analytics — needs a read-only service account (≈10 minutes):**
1. https://console.cloud.google.com → pick/create a project → *APIs & Services* → enable
   **Google Analytics Data API**.
2. *IAM & Admin → Service accounts* → Create (no roles needed) → *Keys → Add key → JSON*.
3. GA → Admin → **Property access management** → add the service account's
   `client_email` with the **Viewer** role.
4. Vercel → Environment Variables (Production):
   - `GA_PROPERTY_ID` = the **numeric** id from GA → Admin → Property details (not `G-…`)
   - `GA_SERVICE_ACCOUNT_JSON` = the whole JSON key file pasted as the value
   → Redeploy.
5. Make sure `platform` is registered as a **User**-scoped custom dimension (section 4) — the
   per-platform GA tables need it. Until then the tab still shows the operating-system split
   and explains what's missing.

GA answers are cached for 10 minutes per range. Visits recorded before the iOS fix (when the
iPhone app was counted as `web`) or before `platform` was registered appear as "Other".

## Code map
`frontend/src/lib/analytics.js` (all logic) · `frontend/src/api.js` (auto-reports API calls) ·
`components/States.jsx` + `pages/AuthLayout.jsx` (`ui_error`) · `App.jsx` (page views, identify) ·
`pages/SchedulePage.jsx` (planner steps, share) · `lib/platform.js` (iOS/Android/web detection) ·
admin dashboard: `components/AdminAnalyticsTab.jsx`, `api/_lib/adminAnalytics.js` (DB),
`api/_lib/ga4.js` (GA Data API), `api/_lib/activity.js` · tests: `npm run test:analytics`,
`npm run test:admin-analytics` (local Postgres, like `test-harness.mjs`).
