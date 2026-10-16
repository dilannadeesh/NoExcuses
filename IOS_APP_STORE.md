# NoExcuses Badminton — App Store submission pack

Everything you paste into App Store Connect. Screenshots are in `store/ios-screenshots/`
(1206 × 2622, the iPhone 6.9" size — Apple scales them down for smaller iPhones).

## App information
| Field | Value |
|---|---|
| Name | NoExcuses Badminton |
| Subtitle (30) | Scores, rankings, tournaments |
| Bundle ID | `noexcusesbadminton.app` |
| SKU | `noexcuses-badminton-ios` |
| Primary category | Sports |
| Secondary category | Utilities (or Health & Fitness) |
| Support URL | https://www.noexcusesbadminton.com/support |
| Marketing URL | https://www.noexcusesbadminton.com |
| Privacy Policy URL | https://www.noexcusesbadminton.com/privacy |
| Copyright | © 2026 *your name* |
| Price | Free |
| Availability | All countries (or pick) |

> The support page shows your email only if `VITE_SUPPORT_EMAIL` is set in Vercel. Set it before submitting —
> Apple clicks the Support URL and rejects a page with no way to contact you.

## Promotional text (170, can change anytime)
Log every badminton game, rank every player fairly and run a real tournament — five minutes to set up, free to start.

## Description
Your badminton group deserves better than a spreadsheet.

NoExcuses Badminton keeps score for your regular games so you can settle the arguments with numbers.

• LOG EVERY GAME — singles or doubles, set by set, with deuce handled properly.
• RANK PLAYERS YOUR WAY — win %, points, or an Elo-style skill rating. Switch any time.
• SEE WHO'S REALLY GOOD — leaderboards, podium, head-to-head records and your best doubles partner.
• RUN TOURNAMENTS — round-robin fixtures, live standings, and a public link anyone can follow without an account.
• PLAN THE NIGHT — build a fair rotation of who plays who, court by court.
• YOUR GROUPS — invite friends by email, own a group, or join one. Group owners keep the scores honest.

Free to use. No ads. Delete your account any time from the Profile tab.

## Keywords (100 chars)
badminton,scoreboard,tournament,ranking,leaderboard,doubles,singles,elo,club,league,shuttle,racket

## What's new (version 1.0)
First release of NoExcuses Badminton on iPhone.

## Age rating questionnaire
All "None" / "No": no violence, no mature content, no gambling, no unrestricted web access (the app only shows its own site), no user-to-user chat or UGC feeds (names and scores inside private groups only).
Expected rating: **4+**.

## Export compliance
Already answered in the build: `ITSAppUsesNonExemptEncryption = false` (the app uses only standard HTTPS). No questions at upload.

## App Privacy (the "nutrition label")
Data collection: **Yes**. **Tracking: No** (nothing is shared with data brokers or used for ads; Google Analytics is used only for product analytics).

| Data type | Collected | Linked to user | Used for |
|---|---|---|---|
| Contact info → Name | Yes | Yes | App functionality |
| Contact info → Email address | Yes | Yes | App functionality (login, password reset) |
| User content → Other user content (games, scores, groups) | Yes | Yes | App functionality |
| Identifiers → User ID (internal number) | Yes | Yes | App functionality, Analytics |
| Usage data → Product interaction | Yes | Yes | Analytics |
| Diagnostics → Performance data / crash-type errors | Yes | No | Analytics |

Passwords are stored only as bcrypt hashes. Not collected: location, contacts, photos, health, financial info, browsing history, advertising ID.
Double-check this table against `/privacy` and your Google Analytics setup before you submit — the labels must match what the app really does.

## Account deletion (guideline 5.1.1(v))
In the app: **Profile tab → Delete my account → enter password → Delete forever**. Also at /delete-account. Done instantly, no email needed.

## App Review information
**Sign-in required:** Yes. Create a demo account first (it's your real site, so do this once, by hand):
1. Open https://www.noexcusesbadminton.com → *Create an account* → e.g. `appreview@noexcusesbadminton.com` + a password.
2. Create a group "Demo Club", add 3 members (names + any emails), and log 2–3 games so the screens aren't empty.
3. Put that email + password in the **Demo account** boxes in App Store Connect.

(Alternatively tell the reviewer to tap *Create an account* — signup is open and instant.)

**Notes for the reviewer** (paste):
> NoExcuses Badminton is a score-keeping and ranking app for recreational badminton groups. The app is a native iOS shell around our service (www.noexcusesbadminton.com) and adds native features: haptic feedback on taps and results, native status-bar styling, a branded offline screen, and secure cookie-based sessions. Sign in with the demo account provided, or tap "Create an account" (no email verification). Open the demo group to see the leaderboard, log a game with "Log a game", view Standings and Tournaments. Account deletion: Profile tab → Delete my account. There is no in-app purchase, advertising or user-to-user messaging. Contact: <your support email>.

**Contact:** your name, phone, email.

## Guideline 4.2 ("repackaged website") — how we address it
Reviewers reject thin web wrappers. Ours differs: it is a real application (accounts, groups, scoring, rankings, tournaments, scheduler — none of it a brochure), has an app-specific UI (bottom tab bar, safe-area layout, no browser chrome), native haptics + status bar, and an offline screen. If Apple still pushes back, reply with the reviewer notes above and offer a short screen recording. Adding Sign in with Apple is *not* required: the app only has its own email login (no third-party social login).

## Checklist
- [ ] Apple Developer account approved
- [ ] App record created in App Store Connect (bundle ID above)
- [ ] GitHub secrets set: `APPLE_TEAM_ID`, `APPSTORE_KEY_ID`, `APPSTORE_ISSUER_ID`, `APPSTORE_KEY_P8`
- [ ] Run **Actions → iOS build / TestFlight** on `main`; build appears in TestFlight (~10 min)
- [ ] `VITE_SUPPORT_EMAIL` set in Vercel and redeployed
- [ ] Demo account + sample data created
- [ ] Screenshots uploaded, text pasted, privacy answers entered
- [ ] Select the build → **Add for Review** → Submit
