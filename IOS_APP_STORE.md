# NoExcuses Badminton — App Store submission pack

Everything you paste into App Store Connect. Screenshots are in `store/ios-screenshots/`
(1206 × 2622, the iPhone 6.9" size — Apple scales them down for smaller iPhones).

## App information
| Field | Value |
|---|---|
| Name | NoExcuses Badminton |
| Subtitle (30) | Scores, rankings & court fees |
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
Log every badminton game, rank players fairly, plan fair matches and split the court fee. Five minutes to set up. Free, no ads.

## Description
Your badminton group deserves better than a spreadsheet.

NoExcuses Badminton keeps score for your regular games so you can settle the arguments with numbers.

• LOG EVERY GAME — singles or doubles, set by set, with deuce handled properly.
• RANK PLAYERS YOUR WAY — win %, points, or an Elo-style skill rating. Switch any time.
• SEE WHO'S REALLY GOOD — leaderboards, podium, head-to-head records and your best doubles partner.
• RUN TOURNAMENTS — round-robin fixtures, live standings, and a public link anyone can follow without an account.
• PLAN THE NIGHT — tick who turned up and get balanced matches for every court; share the plan to WhatsApp.
• SPLIT THE COURT FEE — add the court booking or shuttles, see who owes whom, and mark it settled. (The app keeps the tab; no money moves through it.)
• SHARE THE LEADERBOARD — post it to the group chat as an image.
• YOUR GROUPS — invite friends by email, own a group, or join one. Group owners keep the scores honest.

Free. No ads, no in-app purchases. Delete your account any time from the Profile tab.

## Keywords (100 chars)
badminton,scoreboard,tournament,ranking,leaderboard,doubles,singles,elo,club,league,shuttle,racket

## What's new (version 1.0)
First release of NoExcuses Badminton on iPhone.

## Version and build numbers
`MARKETING_VERSION` is 1.0 in the Xcode project; the build number is the GitHub Actions run number, so every
upload is higher than the last. Bump `MARKETING_VERSION` for each new App Store version after 1.0.

## Age rating questionnaire
Violence, mature themes, gambling, contests, unrestricted web access, messaging/chat: all **None / No** (the app
only shows its own site; there is no chat).

**User-generated content: answer honestly — Yes.** Group admins type group names, player names and expense
descriptions that other members of that private group see. Apple asks whether the app has UGC, and a "No" that
a reviewer can disprove is a rejection. The app has what guideline 1.2 requires for UGC: a published policy
(Terms → Acceptable use, Reporting and blocking), **Report a problem** on every group's Members screen (reports
reach the team and must be acted on within 24 hours), **Leave this group** for members, and owners/admins can
remove members. Expect a **9+ to 13+** rating rather than 4+ — accept whatever the questionnaire gives.

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
| Diagnostics → Performance data (slow requests) | Yes | No | Analytics |
| Diagnostics → Other diagnostic data (error messages) | Yes | No | Analytics |

Passwords are stored only as bcrypt hashes. Not collected: location, contacts, photos, health, financial info, browsing history, advertising ID.
These answers are also in the app's privacy manifest, `mobile/ios/App/App/PrivacyInfo.xcprivacy` — keep the two in
step. Double-check them against `/privacy` and your Google Analytics setup before you submit.
Push device tokens are not a "Device ID" in Apple's sense and are not listed.

## Account deletion (guideline 5.1.1(v))
In the app: **Profile tab → Delete my account → enter password → Delete forever**. Also at /delete-account. Done instantly, no email needed.

## App Review information
**Sign-in required:** Yes. Create a demo account first (it's your real site, so do this once, by hand):
1. Open https://www.noexcusesbadminton.com → *Create an account* → e.g. `appreview@noexcusesbadminton.com` + a password.
2. Create a group "Demo Club", add 3 members (names + any emails), and log 2–3 games so the screens aren't empty.
3. Put that email + password in the **Demo account** boxes in App Store Connect.

(Alternatively tell the reviewer to tap *Create an account* — signup is open and instant.)

**Notes for the reviewer** (paste):
> NoExcuses Badminton is a score-keeping app for recreational badminton groups: log games set by set, rank players (win %, points or an Elo rating), plan balanced matches for a session, run round-robin tournaments and keep track of shared court costs. It uses native iOS features: push notifications when someone settles up with you, the iOS share sheet (leaderboard image, match plan), haptic feedback, a native sign-in screen and an offline screen.
>
> Sign in with the demo account provided. Open "Demo Club" to see the leaderboard; tap "Log a game", the calendar button (plan tonight's games), and "Owe" (shared costs).
>
> Shared costs: the app only records who paid for the court or shuttles and who has settled up. No money is sent, received or processed by the app, and there are no in-app purchases or ads.
>
> Content and safety: groups are private. On any group's Members screen, members can "Report a problem" (goes to our team; we act within 24 hours) or "Leave this group"; owners can remove members. Rules are in Terms → Acceptable use.
>
> Account deletion: Profile tab → Delete my account. Contact: support@noexcusesbadminton.com.

**Contact:** your name, phone, email.

## Guideline 4.2 ("repackaged website") — how we address it
Reviewers reject thin web wrappers. Ours differs: it is a real application (accounts, groups, scoring, rankings, tournaments, scheduler, shared costs — none of it a brochure), has an app-specific UI (native sign-in screen, bottom tab bar, pinned action buttons, no browser chrome, no marketing pages), push notifications, the native share sheet, haptics, status bar styling, and an offline screen. **Push notifications are the strongest native feature: finish the push setup below before submitting** so the reviewer gets a real prompt and notification. If Apple still pushes back, reply with the reviewer notes above and offer a short screen recording. Adding Sign in with Apple is *not* required: the app only has its own email login (no third-party social login).

## Checklist
- [ ] Apple Developer account approved
- [ ] App record created in App Store Connect (bundle ID above)
- [ ] GitHub secrets set: `APPLE_TEAM_ID`, `APPSTORE_KEY_ID`, `APPSTORE_ISSUER_ID`, `APPSTORE_KEY_P8`
- [ ] Run **Actions → iOS build / TestFlight** on `main`; build appears in TestFlight (~10 min)
- [ ] `VITE_SUPPORT_EMAIL` set in Vercel and redeployed (done: support@noexcusesbadminton.com — make sure that inbox
      really receives mail: content reports are emailed there unless `REPORTS_EMAIL` is set)
- [ ] Push notifications switched on (section below) and tested on TestFlight
- [ ] Demo group has an expense in it, so the Owe screen isn't empty
- [ ] Age rating questionnaire answered with **User-generated content: Yes** (see above)
- [ ] Demo account + sample data created
- [ ] Screenshots uploaded, text pasted, privacy answers entered
- [ ] Select the build → **Add for Review** → Submit

## Push notifications ("Settle up" alerts)

The app code is ready; three one-time setup steps turn it on (nothing here goes in chat or in the repo):

1. **Enable the capability.** developer.apple.com → Certificates, Identifiers & Profiles → Identifiers →
   `noexcusesbadminton.app` → tick **Push Notifications** → Save.
2. **Create an APNs key.** Keys → **+** → name it "NoExcuses push" → tick **Apple Push Notifications service (APNs)**
   → Continue → Register → **Download** the `.p8` (only possible once). Note the **Key ID**; your **Team ID** is under Membership.
3. **Vercel** (project `no-excuses` → Settings → Environment Variables, Production): `APNS_KEY_P8` (the whole text of the
   `.p8`), `APNS_KEY_ID`, `APNS_TEAM_ID`. Redeploy.
4. **GitHub** → repo → Settings → Secrets and variables → Actions → **Variables** → New repository variable
   `IOS_PUSH` = `true`. Then run the iOS workflow (Actions → iOS build / TestFlight → Run workflow on `main`).

Install the new TestFlight build, open a group's Owe page and allow notifications when iOS asks.
Android push needs a Firebase project (`google-services.json` in the app and `FIREBASE_SERVICE_ACCOUNT` on Vercel) and is not switched on yet.
